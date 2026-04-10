import { createClient } from 'next-sanity';
import imageUrlBuilder from '@sanity/image-url';

const commonConfig = {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-08-01'
};

// CLIENTE PÚBLICO (Lectura de menú)
export const sanityClientPublic = createClient({
    ...commonConfig,
    useCdn: false,
});

// CLIENTE SERVIDOR (Escritura de ventas)
export const sanityClientServer = createClient({
    ...commonConfig,
    useCdn: false,
    token: process.env.SANITY_API_TOKEN,
    ignoreBrowserTokenWarning: true,
});

// Alias usado en el resto del proyecto (NO TOCAR)
export const client = sanityClientPublic;

// --- CONFIGURACIÓN PARA IMÁGENES ---
const builder = imageUrlBuilder(client);

export function urlFor(source) {
    return builder.image(source);
}
