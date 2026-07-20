import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('PumpNow API (e2e)', () => {
  let app: INestApplication<App> | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const testApp = moduleRef.createNestApplication();
    testApp.setGlobalPrefix('api');
    testApp.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await testApp.init();
    app = testApp;
  });

  it('rejects an invalid portfolio wallet address before querying data', async () => {
    await request(app!.getHttpServer())
      .get('/api/wallets/not-an-address/portfolio')
      .expect(400);
  });

  it('returns an API-backed portfolio snapshot for a valid wallet', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/wallets/0x0000000000000000000000000000000000000001/portfolio')
      .expect(200);
    expect(response.body).toEqual({
      address: '0x0000000000000000000000000000000000000001',
      createdTokens: [],
      holdings: [],
      trades: [],
    });
  });

  afterAll(async () => {
    await app?.close();
  });
});
