// app/hooks/useAccesos.js
import { useState, useEffect } from 'react';

/**
 * Hook para manejar la seguridad y roles (Cajero y Administrador).
 * Validado en servidor para máxima privacidad y seguridad.
 */
export function useAccesos(config, setNombreMesero, { onAdminSuccess } = {}) {
    const [esModoCajero, setEsModoCajero] = useState(false);

    // Persistencia de sesión de Cajero con localStorage
    useEffect(() => {
        const sesionCajero = localStorage.getItem('talanquera_cajero_activa');
        if (sesionCajero === 'true') {
            setEsModoCajero(true);
            setNombreMesero("Caja");
        }
    }, [setNombreMesero]);

    // Lógica para habilitar/deshabilitar modo Cobro (CAJERO)
    const solicitarAccesoCajero = async () => {
        if (esModoCajero) {
            if (confirm("¿Cerrar sesión de Cajero y volver a modo Mesero?")) {
                setEsModoCajero(false);
                localStorage.removeItem('talanquera_cajero_activa');
                setNombreMesero(null);
            }
            return;
        }
        
        const pin = prompt("🔐 PIN para habilitar COBRO:");
        if (!pin) return;

        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin, tipo: 'cajero' })
            });
            const data = await res.json();

            if (data.autorizado) { 
                setEsModoCajero(true);
                localStorage.setItem('talanquera_cajero_activa', 'true');
                setNombreMesero("Caja");
            } else { 
                alert("❌ PIN Incorrecto."); 
            }
        } catch (error) {
            alert("❌ Error de conexión con el servidor de seguridad.");
        }
    };

    // Lógica para acceso administrativo (Reportes sensibles)
    const solicitarAccesoAdmin = async () => {
        const pin = prompt("🔑 PIN de Administrador:");
        if (!pin) return;

        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin, tipo: 'admin' })
            });
            const data = await res.json();

            if (data.autorizado) {
                if (onAdminSuccess) onAdminSuccess(pin);
            } else {
                alert("❌ PIN administrativo incorrecto.");
            }
        } catch (error) {
            alert("❌ Error de seguridad.");
        }
    };

    // 🛡️ NUEVA FUNCIÓN: Para validar acciones críticas (como borrar platos)
    // Se conecta a tu API real de verificación
    const validarPinAdmin = async (pin) => {
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin, tipo: 'admin' })
            });
            const data = await res.json();
            return data.autorizado === true; 
        } catch (error) {
            console.error("Error en validación silenciosa:", error);
            return false;
        }
    };

    // ÚNICO RETURN AL FINAL
    return { 
        esModoCajero, 
        solicitarAccesoCajero, 
        solicitarAccesoAdmin,
        validarPinAdmin 
    };
}