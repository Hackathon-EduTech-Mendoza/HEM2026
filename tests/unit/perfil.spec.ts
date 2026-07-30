import { test, expect } from '@playwright/test';
import { normalizeInstagram, normalizePhone } from '../../src/utils/perfil';

// Lo que se guarda en `profiles` tiene que llegar limpio a mentores y admin,
// sin importar cómo lo escribió la persona en onboarding o en el dashboard.

test.describe('normalizeInstagram', () => {
  const casos: Array<[string, string | null]> = [
    // Lo más común: el arroba adelante
    ['@usuario', 'usuario'],
    ['usuario', 'usuario'],
    ['@@usuario', 'usuario'],
    // Espacios de más al pegar
    ['  @usuario  ', 'usuario'],
    ['us uario', 'usuario'],
    // URL completa pegada del navegador
    ['https://www.instagram.com/usuario', 'usuario'],
    ['https://instagram.com/usuario/', 'usuario'],
    ['instagram.com/usuario', 'usuario'],
    ['www.instagram.com/usuario', 'usuario'],
    // URL con los parámetros de tracking que agrega la app
    ['https://www.instagram.com/usuario?igshid=Abc123', 'usuario'],
    ['instagram.com/usuario/#seccion', 'usuario'],
    // Instagram no distingue mayúsculas: se guarda en minúscula
    ['@Juan.Perez', 'juan.perez'],
    ['HEM2026', 'hem2026'],
    // Punto y guion bajo son válidos y se conservan
    ['@hackathon_edutech.2026', 'hackathon_edutech.2026'],
    // Caracteres que Instagram no admite
    ['@usuario!?', 'usuario'],
    ['@usuario/otro', 'usuario'],
    // Vacío en cualquier forma es null, no cadena vacía
    ['', null],
    ['   ', null],
    ['@', null],
    ['https://www.instagram.com/', null],
  ];

  for (const [entrada, esperado] of casos) {
    test(`"${entrada}" -> ${esperado === null ? 'null' : `"${esperado}"`}`, () => {
      expect(normalizeInstagram(entrada)).toBe(esperado);
    });
  }

  test('null y undefined devuelven null', () => {
    expect(normalizeInstagram(null)).toBeNull();
    expect(normalizeInstagram(undefined)).toBeNull();
  });

  test('es idempotente: normalizar dos veces da lo mismo', () => {
    const unaVez = normalizeInstagram('https://www.instagram.com/Juan.Perez/?igshid=x');
    expect(unaVez).toBe('juan.perez');
    expect(normalizeInstagram(unaVez)).toBe(unaVez);
  });
});

test.describe('normalizePhone', () => {
  const casos: Array<[string, string | null]> = [
    ['+54 9 261 536-5167', '5492615365167'],
    ['(261) 536 5167', '2615365167'],
    ['261-536-5167', '2615365167'],
    ['2615365167', '2615365167'],
    ['  2615365167  ', '2615365167'],
    ['tel: 2615365167', '2615365167'],
    ['', null],
    ['   ', null],
    // Sin ningún dígito no hay teléfono que guardar
    ['no tengo', null],
    ['+', null],
  ];

  for (const [entrada, esperado] of casos) {
    test(`"${entrada}" -> ${esperado === null ? 'null' : `"${esperado}"`}`, () => {
      expect(normalizePhone(entrada)).toBe(esperado);
    });
  }

  test('null y undefined devuelven null', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  test('es idempotente', () => {
    const unaVez = normalizePhone('+54 9 261 536-5167');
    expect(normalizePhone(unaVez)).toBe(unaVez);
  });
});
