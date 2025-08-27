import express from 'express';
import payload from 'payload';
import path from 'path';

require('dotenv').config();

const app = express();

// Инициализация Payload CMS
const start = async (): Promise<void> => {
  // Инициализируем Payload
  await payload.init({
    secret: process.env.PAYLOAD_SECRET || 'your-secret-here',
    express: app,
    onInit: async () => {
      payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`);
    },
  });

  // Добавляем собственные роуты
  app.get('/', (_, res) => {
    res.redirect('/admin');
  });

  // Статические файлы для загруженных медиа
  app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

  const port = process.env.PORT || 3000;

  app.listen(port, async () => {
    payload.logger.info(
      `Server started on port ${port}. Admin panel: http://localhost:${port}/admin`
    );
  });
};

start();

export default app;