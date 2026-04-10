import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export async function POST(request) {
  try {
    const { ordenId } = await request.json();

    if (!ordenId) {
      return NextResponse.json(
        { error: 'ordenId requerido' },
        { status: 400 }
      );
    }

    // 🛡️ Intentamos borrar. En Sanity, borrar algo que no existe no suele dar error catastrófico,
    // pero lo envolvemos para asegurar una respuesta rápida al POS.
    await sanityClientServer.delete(ordenId);

    return NextResponse.json({ 
        message: 'Orden eliminada correctamente',
        success: true 
    });
    
  } catch (error) {
    // Si el error es porque la orden ya no existe, lo tratamos como éxito
    if (error.message.includes('not found')) {
        return NextResponse.json({ message: 'La orden ya no existía', success: true });
    }

    console.error('[API_DELETE_ERROR]:', error);
    return NextResponse.json(
      { error: 'Error interno al eliminar la orden' },
      { status: 500 }
    );
  }
}