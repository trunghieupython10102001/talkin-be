import { Test, TestingModule } from '@nestjs/testing';
import { WssController } from './wss.controller';

describe('WssController', () => {
  let controller: WssController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WssController],
    }).compile();

    controller = module.get<WssController>(WssController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
