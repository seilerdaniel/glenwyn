import { describe, it, expect } from 'vitest';
import {
  PLANS,
  PLAN_LABELS,
  PLAN_LIMITS,
  normalizePlan,
  limitFor,
  canCreateDatabase,
  canUploadFile,
  canAddDatabaseRow,
  MAX_DB_ROWS,
  defaultProfile,
} from './profileRepo';

describe('normalizePlan', () => {
  it('acepta free, plus y business', () => {
    expect(normalizePlan(PLANS.FREE)).toBe(PLANS.FREE);
    expect(normalizePlan(PLANS.PLUS)).toBe(PLANS.PLUS);
    expect(normalizePlan(PLANS.BUSINESS)).toBe(PLANS.BUSINESS);
  });

  it('cae a free para valores raros o nulos', () => {
    expect(normalizePlan('enterprise')).toBe(PLANS.FREE);
    expect(normalizePlan('')).toBe(PLANS.FREE);
    expect(normalizePlan(undefined)).toBe(PLANS.FREE);
    expect(normalizePlan(null)).toBe(PLANS.FREE);
    expect(normalizePlan(123)).toBe(PLANS.FREE);
  });
});

describe('PLAN_LIMITS', () => {
  it('free: 1 base de datos, 50 registros por DB y 5 MB por archivo', () => {
    expect(PLAN_LIMITS[PLANS.FREE].maxDatabases).toBe(1);
    expect(PLAN_LIMITS[PLANS.FREE].maxDbRows).toBe(50);
    expect(PLAN_LIMITS[PLANS.FREE].maxFileSizeBytes).toBe(5 * 1024 * 1024);
  });

  it('plus y business son ilimitados', () => {
    expect(PLAN_LIMITS[PLANS.PLUS].maxDatabases).toBe(Infinity);
    expect(PLAN_LIMITS[PLANS.PLUS].maxDbRows).toBe(Infinity);
    expect(PLAN_LIMITS[PLANS.PLUS].maxFileSizeBytes).toBe(Infinity);
    expect(PLAN_LIMITS[PLANS.BUSINESS].maxDatabases).toBe(Infinity);
    expect(PLAN_LIMITS[PLANS.BUSINESS].maxDbRows).toBe(Infinity);
    expect(PLAN_LIMITS[PLANS.BUSINESS].maxFileSizeBytes).toBe(Infinity);
  });

  it('PLAN_LABELS tiene una etiqueta para cada plan conocido', () => {
    expect(PLAN_LABELS[PLANS.FREE]).toBe('Free');
    expect(PLAN_LABELS[PLANS.PLUS]).toBe('Plus');
    expect(PLAN_LABELS[PLANS.BUSINESS]).toBe('Business');
  });
});

describe('limitFor', () => {
  it('normaliza el plan antes de buscar el límite', () => {
    expect(limitFor('garbage', 'maxDatabases')).toBe(1);
    expect(limitFor(PLANS.PLUS, 'maxDatabases')).toBe(Infinity);
  });
});

describe('canCreateDatabase', () => {
  const free = { plan: PLANS.FREE, isAdmin: false };
  const plus = { plan: PLANS.PLUS, isAdmin: false };
  const admin = { plan: PLANS.FREE, isAdmin: true };

  it('free puede crear la primera base de datos', () => {
    expect(canCreateDatabase(free, 0)).toBe(true);
  });

  it('free NO puede crear la segunda', () => {
    expect(canCreateDatabase(free, 1)).toBe(false);
    expect(canCreateDatabase(free, 2)).toBe(false);
  });

  it('plus y business pueden crear siempre', () => {
    expect(canCreateDatabase(plus, 0)).toBe(true);
    expect(canCreateDatabase(plus, 5)).toBe(true);
    expect(canCreateDatabase(plus, 99)).toBe(true);
  });

  it('admin puede crear siempre aunque esté en free', () => {
    expect(canCreateDatabase(admin, 1)).toBe(true);
    expect(canCreateDatabase(admin, 5)).toBe(true);
  });

  it('tolera contadores raros (string, NaN, undefined)', () => {
    expect(canCreateDatabase(free, '0')).toBe(true);
    expect(canCreateDatabase(free, '1')).toBe(false);
    expect(canCreateDatabase(free, undefined)).toBe(true);
    expect(canCreateDatabase(free, NaN)).toBe(true);
  });

  it('cae a free si el plan del perfil es raro', () => {
    expect(canCreateDatabase({ plan: 'weird', isAdmin: false }, 1)).toBe(false);
  });
});

describe('canAddDatabaseRow', () => {
  const free = { plan: PLANS.FREE, isAdmin: false };
  const plus = { plan: PLANS.PLUS, isAdmin: false };
  const admin = { plan: PLANS.FREE, isAdmin: true };

  it('free puede agregar los primeros 50 registros', () => {
    expect(canAddDatabaseRow(free, 0)).toBe(true);
    expect(canAddDatabaseRow(free, 49)).toBe(true);
    expect(canAddDatabaseRow(free, MAX_DB_ROWS - 1)).toBe(true);
  });

  it('free NO puede agregar el registro 51', () => {
    expect(canAddDatabaseRow(free, MAX_DB_ROWS)).toBe(false);
    expect(canAddDatabaseRow(free, MAX_DB_ROWS + 1)).toBe(false);
    expect(canAddDatabaseRow(free, 200)).toBe(false);
  });

  it('plus y business pueden agregar siempre', () => {
    expect(canAddDatabaseRow(plus, 0)).toBe(true);
    expect(canAddDatabaseRow(plus, MAX_DB_ROWS)).toBe(true);
    expect(canAddDatabaseRow(plus, 1000)).toBe(true);
  });

  it('admin puede agregar siempre aunque esté en free', () => {
    expect(canAddDatabaseRow(admin, MAX_DB_ROWS)).toBe(true);
    expect(canAddDatabaseRow(admin, 500)).toBe(true);
  });

  it('tolera contadores raros (string, NaN, undefined)', () => {
    expect(canAddDatabaseRow(free, '49')).toBe(true);
    expect(canAddDatabaseRow(free, '50')).toBe(false);
    expect(canAddDatabaseRow(free, undefined)).toBe(true);
    expect(canAddDatabaseRow(free, NaN)).toBe(true);
  });

  it('cae a free si el plan del perfil es raro', () => {
    expect(canAddDatabaseRow({ plan: 'weird', isAdmin: false }, MAX_DB_ROWS)).toBe(false);
  });

  it('MAX_DB_ROWS se exporta y vale 50', () => {
    expect(MAX_DB_ROWS).toBe(50);
  });
});

describe('canUploadFile', () => {
  const free = { plan: PLANS.FREE, isAdmin: false };
  const plus = { plan: PLANS.PLUS, isAdmin: false };
  const admin = { plan: PLANS.FREE, isAdmin: true };
  const LIMIT = PLAN_LIMITS[PLANS.FREE].maxFileSizeBytes;

  it('free permite archivos de hasta 5 MB', () => {
    expect(canUploadFile(free, LIMIT - 1)).toBe(true);
    expect(canUploadFile(free, LIMIT)).toBe(true);
  });

  it('free rechaza archivos mayores a 5 MB', () => {
    expect(canUploadFile(free, LIMIT + 1)).toBe(false);
    expect(canUploadFile(free, LIMIT * 2)).toBe(false);
  });

  it('plus y business aceptan cualquier tamaño', () => {
    expect(canUploadFile(plus, LIMIT + 1)).toBe(true);
    expect(canUploadFile(plus, 1024 * 1024 * 1024)).toBe(true);
  });

  it('admin acepta cualquier tamaño aunque esté en free', () => {
    expect(canUploadFile(admin, LIMIT * 10)).toBe(true);
  });

  it('tolera tamaños raros (string, NaN, undefined) como 0', () => {
    expect(canUploadFile(free, undefined)).toBe(true);
    expect(canUploadFile(free, NaN)).toBe(true);
    expect(canUploadFile(free, '1')).toBe(true);
  });
});

describe('defaultProfile', () => {
  it('siempre empieza en free, sin admin ni stripe', () => {
    const p = defaultProfile('user-123');
    expect(p.userId).toBe('user-123');
    expect(p.plan).toBe(PLANS.FREE);
    expect(p.isAdmin).toBe(false);
    expect(p.stripeCustomerId).toBeNull();
    expect(p.stripeSubscriptionId).toBeNull();
    expect(p.currentPeriodEnd).toBeNull();
  });
});
