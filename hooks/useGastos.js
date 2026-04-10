// app/hooks/useGastos.js
export function useGastos() {
    const registrarGasto = async () => {
        const desc = prompt("¿Descripción del gasto?");
        const valorRaw = prompt("¿Monto?");
        
        // Si el usuario cancela el prompt, salimos
        if (!desc || !valorRaw) return false;

        // 🔥 LIMPIEZA PREVIA: Quitamos puntos y cambiamos comas por puntos
        // Esto permite que el validador isNaN no rechace la entrada
        const valorLimpio = valorRaw.toString().replace(/\./g, '').replace(',', '.');

        // Validamos con el valor ya limpio
        if (isNaN(valorLimpio)) {
            alert("❌ Por favor ingrese un número válido.");
            return false;
        }

        try {
            const res = await fetch('/api/gastos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Enviamos el valorLimpio para que la API reciba números puros
                body: JSON.stringify({ descripcion: desc, monto: valorLimpio })
            });
            
            if (res.ok) {
                alert("✅ Gasto guardado correctamente.");
                return true;
            }
        } catch (error) {
            alert("❌ Error al registrar el gasto.");
            return false;
        }
    };

    return { registrarGasto };
}