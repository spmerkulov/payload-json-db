import { CollectionConfig } from 'payload/types';

const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'category', 'status', 'publishedDate'],
    preview: (doc) => {
      return `${process.env.PAYLOAD_PUBLIC_SERVER_URL}/posts/${doc.slug}`;
    },
  },
  access: {
    // Все могут читать опубликованные посты
    read: ({ req: { user } }) => {
      // Если пользователь авторизован, может видеть все посты
      if (user) return true;
      
      // Неавторизованные пользователи видят только опубликованные
      return {
        status: {
          equals: 'published',
        },
      };
    },
    // Только авторизованные пользователи могут создавать посты
    create: ({ req: { user } }) => Boolean(user),
    // Авторы могут редактировать свои посты, админы и редакторы - все
    update: ({ req: { user } }) => {
      if (user?.role === 'admin' || user?.role === 'editor') return true;
      return {
        author: {
          equals: user?.id,
        },
      };
    },
    // Только админы могут удалять посты
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 100,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [
          ({ data, operation, value }) => {
            if (operation === 'create' || !value) {
              const fallback = data?.title
                ?.replace(/ /g, '-')
                ?.replace(/[^\w-]+/g, '')
                ?.toLowerCase();
              
              return fallback;
            }
            return value;
          },
        ],
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ req, operation, value }) => {
            // Автоматически устанавливаем автора при создании
            if (operation === 'create' && !value && req.user) {
              return req.user.id;
            }
            return value;
          },
        ],
      },
    },
    {
      name: 'publishedDate',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            // Автоматически устанавливаем дату публикации
            if (siblingData.status === 'published' && !value) {
              return new Date();
            }
            return value;
          },
        ],
      },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      admin: {
        position: 'sidebar',
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
      name: 'excerpt',
      type: 'textarea',
      maxLength: 300,
      admin: {
        description: 'Short description of the post (max 300 characters)',
      },
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      admin: {
        elements: [
          'h2',
          'h3',
          'h4',
          'blockquote',
          'ul',
          'ol',
          'link',
          'upload',
        ],
        leaves: [
          'bold',
          'italic',
          'underline',
          'strikethrough',
          'code',
        ],
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        {
          label: 'Draft',
          value: 'draft',
        },
        {
          label: 'Published',
          value: 'published',
        },
        {
          label: 'Archived',
          value: 'archived',
        },
      ],
      admin: {
        position: 'sidebar',
      },
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
            description: 'SEO title (max 60 characters)',
          },
        },
        {
          name: 'description',
          type: 'textarea',
          maxLength: 160,
          admin: {
            description: 'SEO description (max 160 characters)',
          },
        },
        {
          name: 'keywords',
          type: 'text',
          admin: {
            description: 'Comma-separated keywords',
          },
        },
        {
          name: 'ogImage',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Open Graph image for social sharing',
          },
        },
      ],
    },
    {
      name: 'readingTime',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Estimated reading time in minutes',
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            // Автоматический расчет времени чтения
            if (siblingData.content) {
              const wordsPerMinute = 200;
              const textContent = JSON.stringify(siblingData.content)
                .replace(/<[^>]*>/g, '') // Удаляем HTML теги
                .replace(/[^\w\s]/g, ' ') // Заменяем знаки препинания на пробелы
                .replace(/\s+/g, ' ') // Убираем лишние пробелы
                .trim();
              
              const wordCount = textContent.split(' ').length;
              const readingTime = Math.ceil(wordCount / wordsPerMinute);
              
              return readingTime;
            }
            return 1;
          },
        ],
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // Автоматически устанавливаем дату обновления
        if (operation === 'update') {
          data.updatedAt = new Date();
        }
        return data;
      },
    ],
    afterChange: [
      ({ doc, operation }) => {
        // Логирование операций с постами
        console.log(`Post ${operation}: "${doc.title}" (${doc.id})`);
        
        // Здесь можно добавить уведомления, очистку кэша и т.д.
      },
    ],
  },
  versions: {
    maxPerDoc: 10,
    drafts: true,
  },
  timestamps: true,
};

export default Posts;