import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { fechaInicio, fechaFin, pinAdmin } = body; 

        // 🛡️ 1. VALIDACIÓN DE PRIVACIDAD
        const seguridad = await sanityClientServer.fetch(
            `*[_type == "seguridad"][0]{ pinAdmin }`,
            {}, 
            { useCdn: false }
        );

        const PIN_ADMIN_REAL = seguridad?.pinAdmin || process.env.PIN_ADMIN;

        if (!pinAdmin || pinAdmin !== PIN_ADMIN_REAL) {
            return NextResponse.json(
                { error: '⚠️ No autorizado. PIN administrativo incorrecto.' },
                { status: 401 }
            );
        }

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json(
                { error: 'Faltan rangos de fecha' },
                { status: 400 }
            );
        }

        const inicio = fechaInicio; 
        const fin = fechaFin; 
        
        // 2. QUERY AMPLIADA (Incluimos detallePagos)
        const queryVentas = `*[_type == "venta" && fechaLocal >= $inicio && fechaLocal <= $fin]{
            "totalPagado": coalesce(totalPagado, 0),
            "propinaRecaudada": coalesce(propinaRecaudada, 0),
            mesero,
            metodoPago,
            detallePagos, 
            platosVendidosV2,
            fechaLocal,
            tipoOrden
        }`;

        const queryGastos = `*[_type == "gasto" && fecha >= $inicio && fecha <= $fin]{
            "monto": coalesce(monto, 0),
            descripcion,
            fecha
        }`;

        const [ventas, gastos] = await Promise.all([
            sanityClientServer.fetch(queryVentas, { inicio, fin }, { useCdn: false }),
            sanityClientServer.fetch(queryGastos, { inicio, fin }, { useCdn: false })
        ]);

        // 📊 3. PROCESAMIENTO ESTRATÉGICO
        const metodosPago = { efectivo: 0, tarjeta: 0, digital: 0 };
        const rankingPlatos = {};
        const porMesero = {}; 
        const porTipoOrden = { mesa: 0, domicilio: 0, llevar: 0 };
        let totalPropinas = 0;

        ventas?.forEach(v => {
            const ventaNeta = Number(v.totalPagado || 0);
            const propina = Number(v.propinaRecaudada || 0);
            const tipo = (v.tipoOrden || 'mesa').toLowerCase().trim();

            totalPropinas += propina;

            // Procesamiento por Tipo de Orden (Tu lógica original intacta)
            if (tipo === 'mesa') {
                porTipoOrden.mesa += ventaNeta;
            } else if (tipo === 'domicilio' || tipo === 'domi') { 
                porTipoOrden.domicilio += ventaNeta;
            } else if (tipo === 'llevar') {
                porTipoOrden.llevar += ventaNeta;
            } else {
                porTipoOrden.mesa += ventaNeta;
            }
        
            // Procesamiento de Meseros
            const nombreM = v.mesero || "General";
            porMesero[nombreM] = (porMesero[nombreM] || 0) + ventaNeta;

            // 🛡️ PROCESAMIENTO DE MÉTODOS DE PAGO (Lógica de Bisturí)
            if (v.detallePagos && v.detallePagos.length > 0) {
                // Si la venta es multimodal, sumamos cada parte
                v.detallePagos.forEach(p => {
                    const m = (p.metodo || 'efectivo').toLowerCase();
                    const montoP = Number(p.monto || 0);
                    if (m.includes('tarjeta')) {
                        metodosPago.tarjeta += montoP;
                    } else if (m.includes('nequi') || m.includes('daviplata') || m.includes('digital') || m.includes('transferencia')) {
                        metodosPago.digital += montoP;
                    } else {
                        metodosPago.efectivo += montoP;
                    }
                });
            } else {
                // Retrocompatibilidad: Si no hay detallePagos, usamos el método principal
                // Sumamos propina para el arqueo de caja admin
                const montoTotal = ventaNeta + propina;
                const metodo = (v.metodoPago || 'efectivo').toLowerCase();
                
                if (metodo.includes('tarjeta')) {
                    metodosPago.tarjeta += montoTotal;
                } else if (metodo.includes('nequi') || metodo.includes('daviplata') || metodo.includes('digital') || metodo.includes('transferencia')) {
                    metodosPago.digital += montoTotal;
                } else {
                    metodosPago.efectivo += montoTotal;
                }
            }

            // Procesamiento de Ranking
            v.platosVendidosV2?.forEach(p => {
                const nombre = p.nombrePlato || "Desconocido";
                rankingPlatos[nombre] = (rankingPlatos[nombre] || 0) + (Number(p.cantidad) || 0);
            });
        });

        const totalVentasSumadas = ventas?.reduce((acc, v) => acc + Number(v.totalPagado || 0), 0) || 0;
        const totalGastosSumados = gastos?.reduce((acc, g) => acc + Number(g.monto || 0), 0) || 0;

        return NextResponse.json({ 
            ventas: ventas || [], 
            gastos: gastos || [],
            ventasTotales: totalVentasSumadas,
            gastosTotales: totalGastosSumados,
            porMesero,
            porTipoOrden,
            estadisticas: {
                metodosPago,
                totalPropinas,
                topPlatos: Object.entries(rankingPlatos)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
            }
        });

    } catch (error) {
        console.error('[REPORT_API_ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}