import { useState } from 'react';
import { client } from '@/lib/sanity';

export function useReportes(getFechaBogota) {
    const [mostrarReporte, setMostrarReporte] = useState(false);
    const [datosReporte, setDatosReporte] = useState({
        ventas: 0,
        totalPropinas: 0,
        gastos: 0,
        productos: {}
    });
    const [cargandoReporte, setCargandoReporte] = useState(false);
    const [fechaInicioReporte, setFechaInicioReporte] = useState(getFechaBogota());
    const [fechaFinReporte, setFechaFinReporte] = useState(getFechaBogota());
    const [listaGastosDetallada, setListaGastosDetallada] = useState([]);

    const [mostrarAdmin, setMostrarAdmin] = useState(false);
    const [reporteAdmin, setReporteAdmin] = useState({
        ventasTotales: 0,
        porMesero: {},
        gastos: 0,
        estadisticas: {
            metodosPago: { efectivo: 0, tarjeta: 0, transferencia: 0 },
            topPlatos: [],
            totalPropinas: 0
        }
    });
    const [cargandoAdmin, setCargandoAdmin] = useState(false);
    const [fechaInicioFiltro, setFechaInicioFiltro] = useState(getFechaBogota());
    const [fechaFinFiltro, setFechaFinFiltro] = useState(getFechaBogota());
    const [pinMemoria, setPinMemoria] = useState(null);

    // ================================================================
    // 📊 1. CIERRE DE DÍA (CAJA RÁPIDA)
    // Usamos el formato exacto que funciona en producción (T00:00:00Z)
    // ================================================================
    // ================================================================
    // 📊 1. CIERRE DE DÍA (CAJA RÁPIDA) - VERSIÓN BLINDADA 12 PM
    // ================================================================
    const generarCierreDia = async () => {
        setCargandoReporte(true);
        setMostrarReporte(true);
        try {
            // 🛡️ Definimos el inicio y fin del rango local (Evita desfase de las 7pm)
            const inicio = `${fechaInicioReporte} 00:00:00`;
            const fin = `${fechaFinReporte} 23:59:59`;

            const queryVentas = `
            *[_type == "venta" && (fechaLocal >= $inicio && fechaLocal <= $fin)]{
                "totalPagado": coalesce(totalPagado, 0),
                "propinaRecaudada": coalesce(propinaRecaudada, 0),
                metodoPago,
                detallePagos,
                platosVendidosV2 // 👈 MANTENEMOS EL NOMBRE ORIGINAL
            }
        `;

            const queryGastos = `
            *[_type == "gasto" && fecha >= $inicio && fecha <= $fin]{
            "monto": coalesce(monto, 0),
            descripcion,
            fecha
            }
            `;

            const [ventas, gastos] = await Promise.all([
                client.fetch(queryVentas, { inicio, fin }, { useCdn: false }),
                client.fetch(queryGastos, { inicio, fin }, { useCdn: false })
            ]);

            let totalVentasNetas = 0;
            let totalPropinas = 0;
            let productos = {};
            let preciosParaExcel = {};
            let metodos = { efectivo: 0, tarjeta: 0, digital: 0 };

            ventas.forEach(v => {
                // 1. Mantenemos tus variables de cálculo originales
                const venta = Number(v.totalPagado || 0);
                const propina = Number(v.propinaRecaudada || 0);

                totalVentasNetas += venta;
                totalPropinas += propina;

                // 🛡️ LÓGICA DE MÉTODOS DE PAGO (Multimodal + Retrocompatibilidad)
                // 🛡️ LÓGICA DE MÉTODOS DE PAGO (Blindada con Lupa y Bisturí)
                // 🛡️ LÓGICA DE MÉTODOS DE PAGO (Versión "Venta Neta" - Sin mezclar Propinas)
if (v.detallePagos && v.detallePagos.length > 0) {
    // 🧠 Si es Pago Dividido: El monto ya viene repartido desde el Modal
    v.detallePagos.forEach(p => {
        const m = p.metodo?.toLowerCase() || 'efectivo';
        const montoParte = Number(p.monto || 0);
        
        // Sumamos solo la parte de la venta
        if (m === 'efectivo') metodos.efectivo += montoParte;
        else if (m === 'tarjeta') metodos.tarjeta += montoParte;
        else if (m === 'digital') metodos.digital += montoParte;
    });
} else {
    // 🔄 Si es venta normal: Usamos solo el 'venta' (totalPagado), ignoramos 'propina'
    const mp = v.metodoPago?.toLowerCase() || 'efectivo';
    
    // 💎 Cirugía: Aquí ya NO sumamos la propina. Solo la venta neta del producto.
    const montoVentaNeta = venta; 

    if (mp === 'efectivo') metodos.efectivo += montoVentaNeta;
    else if (mp === 'tarjeta') metodos.tarjeta += montoVentaNeta;
    else metodos.digital += montoVentaNeta;
}

                // 2. Mantenemos intacta tu lógica de conteo de productos para el Excel y Popularidad
                v.platosVendidosV2?.forEach(p => {
                    const nombre = p.nombrePlato || "Desconocido";
                    productos[nombre] = (productos[nombre] || 0) + Number(p.cantidad || 0);
                    const valorPlato = Number(p.precioUnitario || 0);
                    preciosParaExcel[nombre] = valorPlato;
                }); 
            });

            // 3. Tu lógica de gastos se mantiene igual después del loop de ventas
            const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);

            setDatosReporte({
                ventas: totalVentasNetas,
                totalPropinas,
                gastos: totalGastos,
                productos,
                precios: preciosParaExcel,
                metodosPago: metodos
            });

            setListaGastosDetallada(gastos);
        } catch (error) {
            console.error("🔥 Error crítico en cierre:", error);
            alert("Error al generar cierre de día.");
        } finally {
            setCargandoReporte(false);
        }
    };
    // ================================================================
    // 🔐 2. REPORTE ADMINISTRATIVO (CONEXIÓN CON API)
    // ================================================================
    const cargarReporteAdmin = async (pinRecibido = null) => {
        // 1. Mantenemos tu lógica de validación de PIN y memoria intacta
        let pinFinal = typeof pinRecibido === 'string' ? pinRecibido : pinMemoria;

        if (!pinFinal) pinFinal = prompt("🔑 Ingrese PIN administrativo");
        if (!pinFinal) return;

        setCargandoAdmin(true);
        try {
            const res = await fetch('/api/admin/reportes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // 🛡️ ÚNICO CAMBIO: Quitamos la 'T' y la 'Z' para evitar el desfase UTC
                    // Esto envía "YYYY-MM-DD 00:00:00" que es lo que validamos en Vision
                    fechaInicio: `${fechaInicioFiltro} 00:00:00`,
                    fechaFin: `${fechaFinFiltro} 23:59:59`,
                    pinAdmin: pinFinal
                })
            });

            const data = await res.json();

            // 2. Mantenemos tu manejo de errores de respuesta
            if (!res.ok) throw new Error(data.error || 'Error en el servidor');

            let ventasTotales = 0;
            let porMesero = {};

            // 3. Procesamiento de ventas línea por línea igual al original
            (data.ventas || []).forEach(v => {
                const monto = Number(v.totalPagado || 0);
                ventasTotales += monto;
                const nombre = v.mesero || "General";
                porMesero[nombre] = (porMesero[nombre] || 0) + monto;
            });

            // 4. Procesamiento de gastos intacto
            const totalGastos = (data.gastos || []).reduce(
                (acc, g) => acc + Number(g.monto || 0),
                0
            );

            // 5. Actualización de estados respetando tu estructura de datos
            setPinMemoria(pinFinal);
            setReporteAdmin({
                ventasTotales,
                porMesero,
                gastos: totalGastos,
                // Mantenemos tus estadisticas y sus valores por defecto
                porTipoOrden: data.porTipoOrden || { mesa: 0, domicilio: 0, llevar: 0 },
                estadisticas: data.estadisticas || {
                    metodosPago: { efectivo: 0, tarjeta: 0, transferencia: 0 },
                    topPlatos: [],
                    totalPropinas: 0
                }
            });

            setMostrarAdmin(true);
        } catch (error) {
            // 6. Manejo de errores de consola y alertas idéntico
            console.error("🔥 Error admin:", error);
            alert(error.message || "Error al cargar reporte administrativo.");
        } finally {
            // 7. Liberación del estado de carga
            setCargandoAdmin(false);
        }
    };

    return {
        mostrarReporte, setMostrarReporte,
        datosReporte,
        cargandoReporte,
        fechaInicioReporte, setFechaInicioReporte,
        fechaFinReporte, setFechaFinReporte,
        listaGastosDetallada,
        generarCierreDia,
        mostrarAdmin, setMostrarAdmin,
        reporteAdmin,
        cargandoAdmin,
        fechaInicioFiltro, setFechaInicioFiltro,
        fechaFinFiltro, setFechaFinFiltro,
        cargarReporteAdmin
    };
}