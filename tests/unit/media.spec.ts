import { test, expect } from '@playwright/test';
import { idDeSpotify, idDeYoutube } from '../../src/utils/media';

/**
 * El frontmatter de las noticias lo escribimos a mano pegando la URL que da el
 * botón "Compartir" del medio, así que estos extractores tienen que tragarse
 * las formas reales que salen de ahí, no solo el ID pelado.
 */

const ID = '2FpF6D6MtViyF6CqYSQ2C1'; // el episodio de Aconcagua Radio

test.describe('idDeSpotify', () => {
  test('deja pasar el ID pelado', () => {
    expect(idDeSpotify(ID)).toBe(ID);
    expect(idDeSpotify(`  ${ID}  `)).toBe(ID);
  });

  test('extrae el ID de la URL que copia Spotify', () => {
    expect(idDeSpotify(`https://open.spotify.com/episode/${ID}`)).toBe(ID);
  });

  test('ignora el ?si= que agrega el botón de compartir', () => {
    expect(idDeSpotify(`https://open.spotify.com/episode/${ID}?si=8a1b2c3d4e5f6071`)).toBe(ID);
  });

  test('soporta la URL con idioma y la de embed', () => {
    expect(idDeSpotify(`https://open.spotify.com/intl-es/episode/${ID}`)).toBe(ID);
    expect(idDeSpotify(`https://open.spotify.com/embed/episode/${ID}`)).toBe(ID);
  });

  test('soporta el URI de la app de escritorio', () => {
    expect(idDeSpotify(`spotify:episode:${ID}`)).toBe(ID);
  });

  test('sin coincidencia devuelve lo recibido en vez de romper el build', () => {
    expect(idDeSpotify('https://open.spotify.com/show/algo')).toBe(
      'https://open.spotify.com/show/algo',
    );
  });

  /**
   * Un ID de YouTube son 11 caracteres y puede traer "-" o "_"; uno de Spotify
   * son 22 base62. Que no se confundan importa porque los dos campos conviven
   * en el mismo frontmatter.
   */
  test('no confunde un ID de YouTube con uno de Spotify', () => {
    expect(idDeSpotify('dVG4or61nwk')).toBe('dVG4or61nwk');
    expect(idDeYoutube(ID)).toBe(ID);
  });
});
