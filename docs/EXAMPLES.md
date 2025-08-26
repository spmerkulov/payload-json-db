# Примеры использования

## Содержание

- [Базовая настройка](#базовая-настройка)
- [Блог](#блог)
- [Интернет-магазин](#интернет-магазин)
- [Портфолио](#портфолио)
- [CRM система](#crm-система)
- [Новостной сайт](#новостной-сайт)
- [Продвинутые запросы](#продвинутые-запросы)
- [Интеграции](#интеграции)

## Базовая настройка

### Минимальная конфигурация

```typescript
// payload.config.ts
import { buildConfig } from 'payload/config'
import { JSONAdapter } from 'payload-db-json'

export default buildConfig({
  db: JSONAdapter({
    dataDir: './data'
  }),
  collections: [
    // ваши коллекции
  ]
})
```

### Полная конфигурация

```typescript
// payload.config.ts
import { buildConfig } from 'payload/config'
import { JSONAdapter } from 'payload-db-json'
import path from 'path'

export default buildConfig({
  db: JSONAdapter({
    dataDir: path.resolve(__dirname, './data'),
    encryption: {
      enabled: process.env.NODE_ENV === 'production',
      key: process.env.ENCRYPTION_KEY
    },
    caching: {
      enabled: true,
      ttl: 300000, // 5 минут
      maxSize: 1000
    },
    indexing: {
      enabled: true,
      fields: ['id', 'slug', 'email', 'status']
    },
    performance: {
      batchSize: 100,
      autoSave: true,
      saveInterval: 5000,
      compression: true
    },
    monitoring: {
      enabled: true,
      logLevel: 'info'
    }
  }),
  collections: [
    // ваши коллекции
  ]
})
```

## Блог

### Структура коллекций

```typescript
// collections/Posts.ts
import { CollectionConfig } from 'payload/types'

const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'status', 'publishedAt']
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 100
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar'
      },
      hooks: {
        beforeValidate: [({ value, data }) => {
          if (!value && data?.title) {
            return data.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '')
          }
          return value
        }]
      }
    },
    {
      name: 'content',
      type: 'richText',
      required: true
    },
    {
      name: 'excerpt',
      type: 'textarea',
      maxLength: 300
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media'
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      defaultValue: ({ user }) => user?.id
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true
    },
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'text'
        }
      ]
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Черновик', value: 'draft' },
        { label: 'Опубликовано', value: 'published' },
        { label: 'Архив', value: 'archived' }
      ],
      defaultValue: 'draft',
      admin: {
        position: 'sidebar'
      }
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime'
        }
      }
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        {
          name: 'title',
          type: 'text',
          maxLength: 60
        },
        {
          name: 'description',
          type: 'textarea',
          maxLength: 160
        },
        {
          name: 'keywords',
          type: 'text'
        }
      ]
    }
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          data.createdAt = new Date()
        }
        data.updatedAt = new Date()
        
        if (data.status === 'published' && !data.publishedAt) {
          data.publishedAt = new Date()
        }
        
        return data
      }
    ]
  }
}

export default Posts
```

```typescript
// collections/Categories.ts
const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name'
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true
    },
    {
      name: 'description',
      type: 'textarea'
    },
    {
      name: 'color',
      type: 'text',
      admin: {
        components: {
          Field: ColorPickerField
        }
      }
    }
  ]
}
```

### API использование

```typescript
// Получение опубликованных постов с пагинацией
const getPublishedPosts = async (page = 1, limit = 10) => {
  return await payload.find({
    collection: 'posts',
    where: {
      status: { equals: 'published' },
      publishedAt: { less_than_equal: new Date() }
    },
    sort: '-publishedAt',
    limit,
    page,
    populate: {
      author: {
        select: ['name', 'avatar']
      },
      categories: true,
      featuredImage: true
    }
  })
}

// Поиск постов по тегам
const getPostsByTag = async (tag: string) => {
  return await payload.find({
    collection: 'posts',
    where: {
      and: [
        { status: { equals: 'published' } },
        { 'tags.tag': { contains: tag } }
      ]
    },
    sort: '-publishedAt'
  })
}

// Получение связанных постов
const getRelatedPosts = async (postId: string, categoryIds: string[]) => {
  return await payload.find({
    collection: 'posts',
    where: {
      and: [
        { id: { not_equals: postId } },
        { status: { equals: 'published' } },
        { categories: { in: categoryIds } }
      ]
    },
    limit: 5,
    sort: '-publishedAt'
  })
}
```

## Интернет-магазин

### Структура коллекций

```typescript
// collections/Products.ts
const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'price', 'category', 'stock', 'status']
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true
    },
    {
      name: 'description',
      type: 'richText',
      required: true
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      maxLength: 200
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0
    },
    {
      name: 'salePrice',
      type: 'number',
      min: 0
    },
    {
      name: 'sku',
      type: 'text',
      required: true,
      unique: true
    },
    {
      name: 'stock',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true
    },
    {
      name: 'subcategory',
      type: 'relationship',
      relationTo: 'subcategories'
    },
    {
      name: 'images',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true
        },
        {
          name: 'alt',
          type: 'text'
        }
      ]
    },
    {
      name: 'variants',
      type: 'array',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true
        },
        {
          name: 'value',
          type: 'text',
          required: true
        },
        {
          name: 'priceModifier',
          type: 'number',
          defaultValue: 0
        },
        {
          name: 'stock',
          type: 'number',
          defaultValue: 0
        }
      ]
    },
    {
      name: 'attributes',
      type: 'array',
      fields: [
        {
          name: 'name',
          type: 'text'
        },
        {
          name: 'value',
          type: 'text'
        }
      ]
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Активный', value: 'active' },
        { label: 'Неактивный', value: 'inactive' },
        { label: 'Распродан', value: 'out_of_stock' }
      ],
      defaultValue: 'active'
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false
    },
    {
      name: 'weight',
      type: 'number',
      min: 0
    },
    {
      name: 'dimensions',
      type: 'group',
      fields: [
        {
          name: 'length',
          type: 'number'
        },
        {
          name: 'width',
          type: 'number'
        },
        {
          name: 'height',
          type: 'number'
        }
      ]
    }
  ]
}
```

```typescript
// collections/Orders.ts
const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'customer', 'total', 'status', 'createdAt']
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        readOnly: true
      }
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true
        },
        {
          name: 'variant',
          type: 'text'
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1
        },
        {
          name: 'price',
          type: 'number',
          required: true
        }
      ]
    },
    {
      name: 'subtotal',
      type: 'number',
      required: true
    },
    {
      name: 'tax',
      type: 'number',
      defaultValue: 0
    },
    {
      name: 'shipping',
      type: 'number',
      defaultValue: 0
    },
    {
      name: 'total',
      type: 'number',
      required: true
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Ожидает оплаты', value: 'pending' },
        { label: 'Оплачен', value: 'paid' },
        { label: 'Обрабатывается', value: 'processing' },
        { label: 'Отправлен', value: 'shipped' },
        { label: 'Доставлен', value: 'delivered' },
        { label: 'Отменен', value: 'cancelled' }
      ],
      defaultValue: 'pending'
    },
    {
      name: 'shippingAddress',
      type: 'group',
      fields: [
        { name: 'firstName', type: 'text', required: true },
        { name: 'lastName', type: 'text', required: true },
        { name: 'address1', type: 'text', required: true },
        { name: 'address2', type: 'text' },
        { name: 'city', type: 'text', required: true },
        { name: 'state', type: 'text', required: true },
        { name: 'zipCode', type: 'text', required: true },
        { name: 'country', type: 'text', required: true }
      ]
    }
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          data.orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        }
        return data
      }
    ]
  }
}
```

### API использование

```typescript
// Получение товаров с фильтрацией
const getProducts = async (filters: any) => {
  const where: any = { status: { equals: 'active' } }
  
  if (filters.category) {
    where.category = { equals: filters.category }
  }
  
  if (filters.priceRange) {
    where.price = {
      greater_than_equal: filters.priceRange.min,
      less_than_equal: filters.priceRange.max
    }
  }
  
  if (filters.search) {
    where.or = [
      { name: { contains: filters.search } },
      { description: { contains: filters.search } }
    ]
  }
  
  return await payload.find({
    collection: 'products',
    where,
    sort: filters.sort || '-createdAt',
    limit: filters.limit || 20,
    page: filters.page || 1
  })
}

// Создание заказа
const createOrder = async (orderData: any) => {
  // Проверка наличия товаров
  for (const item of orderData.items) {
    const product = await payload.findByID({
      collection: 'products',
      id: item.product
    })
    
    if (product.stock < item.quantity) {
      throw new Error(`Недостаточно товара ${product.name} на складе`)
    }
  }
  
  // Создание заказа
  const order = await payload.create({
    collection: 'orders',
    data: orderData
  })
  
  // Обновление остатков
  for (const item of orderData.items) {
    await payload.update({
      collection: 'products',
      id: item.product,
      data: {
        stock: { $inc: -item.quantity }
      }
    })
  }
  
  return order
}
```

## Портфолио

### Структура коллекций

```typescript
// collections/Projects.ts
const Projects: CollectionConfig = {
  slug: 'projects',
  admin: {
    useAsTitle: 'title'
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true
    },
    {
      name: 'description',
      type: 'richText',
      required: true
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      maxLength: 200
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      required: true
    },
    {
      name: 'gallery',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media'
        },
        {
          name: 'caption',
          type: 'text'
        }
      ]
    },
    {
      name: 'technologies',
      type: 'relationship',
      relationTo: 'technologies',
      hasMany: true
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'project-categories'
    },
    {
      name: 'client',
      type: 'text'
    },
    {
      name: 'projectUrl',
      type: 'text'
    },
    {
      name: 'githubUrl',
      type: 'text'
    },
    {
      name: 'completedAt',
      type: 'date'
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'В разработке', value: 'in_progress' },
        { label: 'Завершен', value: 'completed' },
        { label: 'Приостановлен', value: 'paused' }
      ],
      defaultValue: 'completed'
    }
  ]
}
```

## Продвинутые запросы

### Сложная фильтрация

```typescript
// Поиск с множественными условиями
const complexSearch = async () => {
  return await payload.find({
    collection: 'posts',
    where: {
      and: [
        {
          or: [
            { title: { contains: 'JavaScript' } },
            { content: { contains: 'React' } },
            { 'tags.tag': { in: ['js', 'react', 'frontend'] } }
          ]
        },
        {
          status: { equals: 'published' }
        },
        {
          publishedAt: {
            greater_than: new Date('2024-01-01'),
            less_than: new Date('2024-12-31')
          }
        },
        {
          'author.role': { equals: 'editor' }
        }
      ]
    },
    sort: ['-publishedAt', 'title'],
    limit: 50,
    populate: {
      author: {
        select: ['name', 'email', 'avatar']
      },
      categories: true
    }
  })
}

// Агрегация данных
const getStatistics = async () => {
  const totalPosts = await payload.count({ collection: 'posts' })
  const publishedPosts = await payload.count({
    collection: 'posts',
    where: { status: { equals: 'published' } }
  })
  
  const postsByCategory = await payload.find({
    collection: 'posts',
    where: { status: { equals: 'published' } },
    populate: { categories: true }
  })
  
  // Группировка по категориям
  const categoryStats = postsByCategory.docs.reduce((acc, post) => {
    post.categories.forEach(category => {
      acc[category.name] = (acc[category.name] || 0) + 1
    })
    return acc
  }, {})
  
  return {
    totalPosts,
    publishedPosts,
    draftPosts: totalPosts - publishedPosts,
    categoryStats
  }
}
```

### Пакетные операции

```typescript
// Массовое обновление
const bulkUpdate = async (ids: string[], updateData: any) => {
  const promises = ids.map(id => 
    payload.update({
      collection: 'posts',
      id,
      data: updateData
    })
  )
  
  return await Promise.all(promises)
}

// Массовое создание
const bulkCreate = async (items: any[]) => {
  const promises = items.map(item => 
    payload.create({
      collection: 'posts',
      data: item
    })
  )
  
  return await Promise.all(promises)
}
```

## Интеграции

### Next.js интеграция

```typescript
// pages/api/posts/[...slug].ts
import { NextApiRequest, NextApiResponse } from 'next'
import payload from 'payload'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { slug } = req.query
  
  try {
    switch (req.method) {
      case 'GET':
        if (slug.length === 1) {
          // Получение всех постов
          const posts = await payload.find({
            collection: 'posts',
            where: { status: { equals: 'published' } },
            sort: '-publishedAt',
            limit: parseInt(req.query.limit as string) || 10,
            page: parseInt(req.query.page as string) || 1
          })
          res.json(posts)
        } else {
          // Получение конкретного поста
          const post = await payload.find({
            collection: 'posts',
            where: {
              and: [
                { slug: { equals: slug[1] } },
                { status: { equals: 'published' } }
              ]
            },
            limit: 1
          })
          
          if (post.docs.length === 0) {
            res.status(404).json({ error: 'Post not found' })
          } else {
            res.json(post.docs[0])
          }
        }
        break
        
      default:
        res.setHeader('Allow', ['GET'])
        res.status(405).end(`Method ${req.method} Not Allowed`)
    }
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
```

### React хуки

```typescript
// hooks/usePosts.ts
import { useState, useEffect } from 'react'

interface Post {
  id: string
  title: string
  content: string
  slug: string
  publishedAt: string
}

export const usePosts = (page = 1, limit = 10) => {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/posts?page=${page}&limit=${limit}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch posts')
        }
        
        const data = await response.json()
        setPosts(data.docs)
        setTotalPages(data.totalPages)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    
    fetchPosts()
  }, [page, limit])
  
  return { posts, loading, error, totalPages }
}

export const usePost = (slug: string) => {
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/posts/${slug}`)
        
        if (!response.ok) {
          throw new Error('Post not found')
        }
        
        const data = await response.json()
        setPost(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    
    if (slug) {
      fetchPost()
    }
  }, [slug])
  
  return { post, loading, error }
}
```

### GraphQL интеграция

```typescript
// graphql/resolvers.ts
import payload from 'payload'

export const resolvers = {
  Query: {
    posts: async (_, { where, sort, limit, page }) => {
      return await payload.find({
        collection: 'posts',
        where,
        sort,
        limit,
        page
      })
    },
    
    post: async (_, { id, slug }) => {
      if (id) {
        return await payload.findByID({
          collection: 'posts',
          id
        })
      }
      
      if (slug) {
        const result = await payload.find({
          collection: 'posts',
          where: { slug: { equals: slug } },
          limit: 1
        })
        return result.docs[0] || null
      }
      
      throw new Error('Either id or slug must be provided')
    }
  },
  
  Mutation: {
    createPost: async (_, { data }) => {
      return await payload.create({
        collection: 'posts',
        data
      })
    },
    
    updatePost: async (_, { id, data }) => {
      return await payload.update({
        collection: 'posts',
        id,
        data
      })
    },
    
    deletePost: async (_, { id }) => {
      await payload.delete({
        collection: 'posts',
        id
      })
      return true
    }
  }
}
```

Эти примеры демонстрируют различные способы использования JSON Database Adapter с Payload CMS для создания полнофункциональных веб-приложений.