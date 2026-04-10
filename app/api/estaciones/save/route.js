import { sanityClientServer } from '@/lib/sanity';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { fingerprint, nombre, categorias } = body;

        const idLimpio = `estacion-${fingerprint.replace(/[^a-zA-Z0-9]/g, '-')}`;

        const result = await sanityClientServer.createOrReplace({
            _id: idLimpio,
            _type: 'estacionPC',
            nombre: nombre || 'Caja Principal',
            pcFingerprint: fingerprint,
            categoriasVinculadas: categorias
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("🔥 Error API Estaciones:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}