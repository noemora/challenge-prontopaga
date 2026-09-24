import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Desmonta el arbol de React entre pruebas.
 *
 * Sin esto, los componentes de un test siguen en el documento durante el
 * siguiente y las consultas por texto encuentran coincidencias duplicadas.
 */
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
