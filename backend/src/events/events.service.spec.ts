import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let module: TestingModule;
  let service: EventsService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [EventsService],
    }).compile();
    service = module.get<EventsService>(EventsService);
  });

  // Closes the testing module (and anything it initialized — DB
  // connections, timers, event emitters, etc.) after each test. Without
  // this, a service with any lifecycle hooks (onModuleInit/onModuleDestroy)
  // or open handles can leak across tests or leave Jest hanging waiting for
  // the process to exit, and it gets much more likely to bite once this
  // file grows past a single trivial test.
  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // TODO: this file only smoke-tests that DI resolves EventsService — it
  // doesn't exercise any actual behavior yet. Once you share
  // events.service.ts (or I can view it if it's in this project), real
  // tests belong here, e.g.:
  //   describe('createEvent', () => { ... })
  //   describe('findAll', () => { ... })
  //   describe('emit', () => { ... })
  // If EventsService takes constructor dependencies (a repository, an
  // EventEmitter2, another service), they'll need to be mocked in the
  // `providers` array above — e.g.:
  //   providers: [
  //     EventsService,
  //     { provide: getRepositoryToken(Event), useValue: mockRepo },
  //   ],
});