import { CollectionConfig } from 'payload/types';
import path from 'path';

const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: path.resolve(__dirname, '../../uploads'),
    staticURL: '/uploads',
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 640,
        height: 480,
        position: 'centre',
      },
      {
        name: 'tablet',
        width: 1024,
        height: undefined,
        position: 'centre',
      },
      {
        name: 'desktop',
        width: 1920,
        height: undefined,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/wav',
    ],
  },
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'mimeType', 'filesize', 'createdAt'],
  },
  access: {
    // Все могут читать медиа файлы
    read: () => true,
    // Только авторизованные пользователи могут загружать файлы
    create: ({ req: { user } }) => Boolean(user),
    // Авторы могут обновлять свои файлы, админы и редакторы - все
    update: ({ req: { user } }) => {
      if (user?.role === 'admin' || user?.role === 'editor') return true;
      return {
        uploadedBy: {
          equals: user?.id,
        },
      };
    },
    // Только админы могут удалять медиа файлы
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Alternative text for accessibility and SEO',
      },
    },
    {
      name: 'caption',
      type: 'text',
      admin: {
        description: 'Optional caption for the media',
      },
    },
    {
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ req, operation, value }) => {
            // Автоматически устанавливаем пользователя при загрузке
            if (operation === 'create' && !value && req.user) {
              return req.user.id;
            }
            return value;
          },
        ],
      },
    },
    {
      name: 'tags',
      type: 'array',
      maxRows: 10,
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Images', value: 'images' },
        { label: 'Documents', value: 'documents' },
        { label: 'Videos', value: 'videos' },
        { label: 'Audio', value: 'audio' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            // Автоматически определяем категорию по MIME типу
            if (!value && siblingData.mimeType) {
              const mimeType = siblingData.mimeType;
              
              if (mimeType.startsWith('image/')) return 'images';
              if (mimeType.startsWith('video/')) return 'videos';
              if (mimeType.startsWith('audio/')) return 'audio';
              if (mimeType === 'application/pdf') return 'documents';
              
              return 'other';
            }
            return value;
          },
        ],
      },
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Make this file publicly accessible',
      },
    },
    {
      name: 'metadata',
      type: 'group',
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'width',
          type: 'number',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'height',
          type: 'number',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'duration',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'Duration in seconds (for video/audio)',
          },
        },
        {
          name: 'exif',
          type: 'json',
          admin: {
            readOnly: true,
            description: 'EXIF data for images',
          },
        },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        {
          name: 'title',
          type: 'text',
          maxLength: 60,
          admin: {
            description: 'SEO title for this media file',
          },
        },
        {
          name: 'description',
          type: 'textarea',
          maxLength: 160,
          admin: {
            description: 'SEO description for this media file',
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        // Автоматически заполняем alt текст если он пустой
        if (operation === 'create' && !data.alt && data.filename) {
          data.alt = data.filename
            .replace(/\.[^/.]+$/, '') // Убираем расширение
            .replace(/[-_]/g, ' ') // Заменяем дефисы и подчеркивания на пробелы
            .replace(/\b\w/g, (l) => l.toUpperCase()); // Делаем первые буквы заглавными
        }
        
        return data;
      },
    ],
    afterChange: [
      ({ doc, operation }) => {
        console.log(`Media ${operation}: "${doc.filename}" (${doc.id})`);
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        // Проверяем, используется ли файл в постах
        const posts = await req.payload.find({
          collection: 'posts',
          where: {
            or: [
              {
                featuredImage: {
                  equals: id,
                },
              },
              {
                'seo.ogImage': {
                  equals: id,
                },
              },
            ],
          },
          limit: 1,
        });
        
        if (posts.totalDocs > 0) {
          throw new Error(
            `Cannot delete media file. It is being used in ${posts.totalDocs} post(s).`
          );
        }
        
        // Проверяем, используется ли файл в пользователях
        const users = await req.payload.find({
          collection: 'users',
          where: {
            avatar: {
              equals: id,
            },
          },
          limit: 1,
        });
        
        if (users.totalDocs > 0) {
          throw new Error(
            `Cannot delete media file. It is being used as avatar for ${users.totalDocs} user(s).`
          );
        }
      },
    ],
  },
  timestamps: true,
};

export default Media;