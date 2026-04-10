'use client';
import React, { useCallback, useMemo } from 'react';

export function useImpresion(cart, config) {
    // 1. Memorizamos las funciones individualmente
    const imprimirTicket = useCallback((datosExtras = {}) => {
        if (!cart?.length) return;

        const ticketData = {
            productos: [...cart], // Clonamos para evitar referencias
            mesa: datosExtras.mesa || "Mesa",
            mesero: datosExtras.mesero || "Caja",
            tipoOrden: datosExtras.tipoOrden || "mesa",
            propina: datosExtras.propina || 0,
            montoManual: datosExtras.montoManual || 0,
            fecha: new Date().toISOString()
        };

        sessionStorage.setItem('ticket_preview_data', JSON.stringify(ticketData));

        const esMovil = /iPhone|Android/i.test(navigator.userAgent);
        const url = '/ticket/preview?type=cliente';
        
        if (esMovil) {
            window.open(url, '_blank');
        } else {
            const ancho = 420;
            const alto = 700;
            const x = (window.screen.width / 2) - (ancho / 2);
            const y = (window.screen.height / 2) - (alto / 2);
            window.open(url, 'TicketWindow', `width=${ancho},height=${alto},left=${x},top=${y}`);
        }
    }, [cart]);

   // Cambia esto:
const imprimirCocina = useCallback((platosFiltrados = null) => {
    // Si pasamos platos específicos (desde el Watcher), usamos esos. 
    // Si no (botón manual), usamos todo el cart.
    const datosAImprimir = platosFiltrados || cart;
    if (!datosAImprimir?.length) return;

    // Guardamos temporalmente en sessionStorage para que el Template lo lea
    sessionStorage.setItem('cocina_print_data', JSON.stringify(datosAImprimir));

    document.body.classList.add('imprimiendo-cocina');
    setTimeout(() => { 
        window.print(); 
        document.body.classList.remove('imprimiendo-cocina');
        sessionStorage.removeItem('cocina_print_data'); // Limpieza
    }, 300);
}, [cart]);

    const agruparParaCliente = useCallback(() => {
        if (!cart?.length) return [];
        const agrupados = cart.reduce((acc, item) => {
            const key = `${item.nombre}-${item.precioNum || 0}`;
            if (!acc[key]) acc[key] = { nombre: item.nombre, cantidad: 0, subtotal: 0 };
            acc[key].cantidad += item.cantidad;
            acc[key].subtotal += (item.precioNum * item.cantidad);
            return acc;
        }, {});
        return Object.values(agrupados);
    }, [cart]);

    const agruparParaCocina = useCallback(() => {
        if (!cart?.length) return [];
        // ... (tu lógica de ordenamiento de cocina)
        const lista = cart.map(i => ({...i})); 
        return lista; // Simplificado para estabilidad, puedes re-añadir tu sort aquí
    }, [cart]);

    // 2. EL PAQUETE FINAL: Esto detiene el titileo definitivamente
    return useMemo(() => ({ 
        imprimirTicket,
        imprimirCocina,
        agruparParaCliente,
        agruparParaCocina
    }), [imprimirTicket, imprimirCocina, agruparParaCliente, agruparParaCocina]);
}