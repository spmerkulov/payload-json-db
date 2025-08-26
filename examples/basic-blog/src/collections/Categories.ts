import { CollectionConfig } from 'payload/types';

const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'description', 'postsCount'],
  },
  access: {
    // Все могут читать категории
    read: () => true,
    // Только авторизованные пользователи могут создавать категории
    create: ({ req: { user } }) => Boolean(user),
    // Только админы и редакторы могут обновлять категории
    update: ({ req: { user } }) => {
      return user?.role === 'admin' || user?.role === 'editor';
    },
    // Только админы могут удалять категории
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 50,
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
              const fallback = data?.name
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
      name: 'description',
      type: 'textarea',
      maxLength: 200,
    },
    {
      name: 'color',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Hex color code for category (e.g., #FF5733)',
      },
      validate: (val) => {
        if (val && !val.match(/^#[0-9A-F]{6}$/i)) {
          return 'Please enter a valid hex color code (e.g., #FF5733)';
        }
        return true;
      },
    },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'media',
      admin: {
        position: 'sidebar',
        description: 'Category icon (optional)',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      admin: {
        position: 'sidebar',
        description: 'Parent category for hierarchical structure',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'postsCount',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Number of posts in this category',
      },
      hooks: {
        beforeChange: [
          async ({ req, value, originalDoc }) => {
            // Подсчитываем количество постов в категории
            try {
              const posts = await req.payload.find({
                collection: 'posts',
                where: {
                  category: {
                    equals: originalDoc?.id || req.data?.id,
                  },
                },
                limit: 0, // Получаем только count
              });
              
              return posts.totalDocs;
            } catch (error) {
              console.error('Error counting posts for category:', error);
              return value || 0;
            }
          },
        ],
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
      ],
    },
  ],
  hooks: {
    afterChange: [
      ({ doc, operation }) => {
        console.log(`Category ${operation}: "${doc.name}" (${doc.id})`);
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        // Проверяем, есть ли посты в этой категории
        const posts = await req.payload.find({
          collection: 'posts',
          where: {
            category: {
              equals: id,
            },
          },
          limit: 1,
        });
        
        if (posts.totalDocs > 0) {
          throw new Error(
            `Cannot delete category. It contains ${posts.totalDocs} post(s). Please move or delete the posts first.`
          );
        }
      },
    ],
  },
  timestamps: true,
};

export default Categories;