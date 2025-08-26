import { CollectionConfig } from 'payload/types';

const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 7200, // 2 часа
    verify: false,
    maxLoginAttempts: 5,
    lockTime: 600 * 1000, // 10 минут
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'role'],
  },
  access: {
    // Только администраторы могут создавать пользователей
    create: ({ req: { user } }) => {
      return user?.role === 'admin';
    },
    // Пользователи могут читать только свои данные, админы - все
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true;
      return {
        id: {
          equals: user?.id,
        },
      };
    },
    // Пользователи могут обновлять только свои данные
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true;
      return {
        id: {
          equals: user?.id,
        },
      };
    },
    // Только администраторы могут удалять пользователей
    delete: ({ req: { user } }) => {
      return user?.role === 'admin';
    },
  },
  fields: [
    {
      name: 'firstName',
      type: 'text',
      required: true,
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'Editor',
          value: 'editor',
        },
        {
          label: 'User',
          value: 'user',
        },
      ],
      access: {
        // Только администраторы могут изменять роли
        update: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'bio',
      type: 'textarea',
      maxLength: 500,
    },
    {
      name: 'socialLinks',
      type: 'array',
      maxRows: 5,
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: [
            { label: 'Twitter', value: 'twitter' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'LinkedIn', value: 'linkedin' },
            { label: 'GitHub', value: 'github' },
            { label: 'Website', value: 'website' },
          ],
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          validate: (val) => {
            if (val && !val.match(/^https?:\/\/.+/)) {
              return 'Please enter a valid URL starting with http:// or https://';
            }
            return true;
          },
        },
      ],
    },
    {
      name: 'preferences',
      type: 'group',
      fields: [
        {
          name: 'theme',
          type: 'select',
          defaultValue: 'light',
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'Auto', value: 'auto' },
          ],
        },
        {
          name: 'emailNotifications',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'language',
          type: 'select',
          defaultValue: 'en',
          options: [
            { label: 'English', value: 'en' },
            { label: 'Русский', value: 'ru' },
          ],
        },
      ],
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
        // Логирование создания/обновления пользователей
        console.log(`User ${operation}: ${doc.email} (${doc.id})`);
      },
    ],
  },
  timestamps: true,
};

export default Users;