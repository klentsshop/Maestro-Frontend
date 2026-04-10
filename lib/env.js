// Archivo: lib/env.js

export const ENV = {
    mode: "production", // Siempre en production para que use la lógica real
    // Aquí puedes agregar otras variables si las necesitas en el futuro
};

// Ya no necesitamos DEMO_DATA porque usaremos un Dataset real de Sanity
export const DEMO_DATA = {
    platos: [],
    meseros: []
};