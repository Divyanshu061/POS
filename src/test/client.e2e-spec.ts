/* eslint-disable @typescript-eslint/no-unsafe-assignment, 
              @typescript-eslint/no-unsafe-member-access, 
              @typescript-eslint/no-unsafe-argument, 
              @typescript-eslint/no-unnecessary-type-assertion */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';

import { AuthModule } from '../auth/auth.module';
import { ClientModule } from '../crm/client/client.module';

import { Client } from '../crm/client/entities/client.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

describe('ClientModule E2E', () => {
  let app: INestApplication;
  let jwtToken: string;
  let createdClientId: string;

  beforeAll(async () => {
    jest.setTimeout(30000); // ✅ Set global timeout for E2E

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'div_09', // 🔁 Replace with actual password
          database: 'pos_test_db', // 🔁 Make sure this DB exists
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize: false, // never true in production
          dropSchema: true,
          logging: false,
          migrationsRun: true,
        }),
        TypeOrmModule.forFeature([User, Role, Client, Permission]),
        AuthModule,
        ClientModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableShutdownHooks(); // ✅ Ensure clean shutdown
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Register and login test user
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'changeme' })
      .expect(201);

    const { body } = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'changeme' })
      .expect(200);

    jwtToken = body.access_token;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should create a new client', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/crm/clients')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        name: 'Test Co',
        email: 'client@test.com',
        status: 'lead',
        tags: ['alpha'],
      })
      .expect(201);

    expect(body.id).toBeDefined();
    createdClientId = body.id;
  });

  it('should get list of clients', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/v1/crm/clients')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('should get a single client', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/api/v1/crm/clients/${createdClientId}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(body.id).toEqual(createdClientId);
  });

  it('should update the client', async () => {
    const { body } = await request(app.getHttpServer())
      .put(`/api/v1/crm/clients/${createdClientId}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ status: 'active', tags: ['beta'] })
      .expect(200);

    expect(body.status).toEqual('active');
    expect(body.tags).toContain('beta');
  });

  it('should delete the client', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/crm/clients/${createdClientId}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/crm/clients/${createdClientId}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(404);
  });
});
