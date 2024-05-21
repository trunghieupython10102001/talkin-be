import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const server = express();

  const httpsOptions = {
    key: undefined,
    cert: undefined,
  };
  let hasHttps = true;

  try {
    httpsOptions.key = readFileSync(join(__dirname, '../certs/privkey.pem'));
    httpsOptions.cert = readFileSync(join(__dirname, '../certs/fullchain.pem'));
  } catch (e) {
    hasHttps = false;
  }

  const app = hasHttps
    ? await NestFactory.create(AppModule, new ExpressAdapter(server), {
        httpsOptions,
        cors: true,
      })
    : await NestFactory.create(AppModule);

  app.use('/api/v1/uploads', express.static('uploads'));
  app.use('/api/v1/records', express.static('records'));

  app.setGlobalPrefix('api/v1');

  if (process.env.NODE_ENV === 'development') {
    const configBuilder = new DocumentBuilder()
      .setTitle('API documentation')
      .setDescription('Talkin')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, configBuilder);
    SwaggerModule.setup('api-docs', app, document);

    // enable cors for development
    app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });
  }

  app.useGlobalPipes(new ValidationPipe());
  const PORT = parseInt(process.env.PORT || '3000', 10);
  console.log('listen at port: ', PORT);
  await app.listen(PORT);

  // app.useWebSocketAdapter(new IoAdapter(app));
}
bootstrap();
