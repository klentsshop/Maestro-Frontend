import { client } from '@/lib/sanity';

// 🛒 Obtener Menú (ACTUALIZADO PARA MAP Y CONTADOR LOCAL)
export async function getProductos() {
    return await client.fetch(
       `*[_type == "plato" && (disponible == true || !defined(disponible))] | order(nombre asc){ 
            _id, 
            nombre, 
            precio, 
            disponible,
            "categoria": coalesce(categoria->titulo, "COCINA"),
            "seImprime": coalesce(categoria->seImprime, true),
            imagen,
            controlaInventario,
            insumoVinculado,
            cantidadADescontar,
            totalVentas,
            "recetaInsumos": recetaInsumos[]{
            "insumoId": insumo._ref, // 👈 Convertimos la referencia en String
            cantidad
        },
            // 🔥 SECCIÓN CRÍTICA: Traemos los datos del insumo vinculado para el Map
            "stockActual": coalesce(insumoVinculado->stockActual, 0),
            "stockMinimo": coalesce(insumoVinculado->stockMinimo, 0)
        }`,
        {},
        { useCdn: false }
    );
}

// 👥 Obtener Meseros
export async function getMeseros() {
    return await client.fetch(`*[_type == "mesero"] | order(nombre asc)`);
}

// 🛡️ Obtener PIN de Seguridad
export async function getSeguridad() {
    return await client.fetch(
        `*[_type == "seguridad"][0]{ pinAdmin, pinCajero }`,
        {},
        { useCdn: false }
    );
}

// 📊 Guardar Venta (Centralizado)
export async function registrarVenta(datosVenta) {
    const res = await fetch('/api/ventas', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(datosVenta) 
    });
    return res;
}



