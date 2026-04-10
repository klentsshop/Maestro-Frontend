import React, { memo, useMemo } from 'react';
import { formatPrecioDisplay, categoriasMap } from '@/lib/utils';
import { urlFor } from '@/lib/sanity';
// ✅ Importamos la configuración maestra para la moneda y lógica
import { SITE_CONFIG } from '@/lib/config';
import { Settings } from 'lucide-react';

const ProductGrid = memo(({
    platos, platosFiltrados, busqueda, setBusqueda, categoriaActiva, setCategoriaActiva,
    mostrarCategoriasMobile, setMostrarCategoriasMobile, agregarAlCarrito, 
    styles, mostrarCarritoMobile, setMostrarCarritoMobile, cart, total, mensajeExito, ordenesActivas, cargarOrden, ordenActivaId, setMostrarConfigImpresion
}) => {
    const listaCategorias = useMemo(() => ['todos', ...new Set(platos.map(p => p.categoria))], [platos]);

// 🔥 2. LÓGICA DE ORDENAMIENTO INTELIGENTE (PROFESIONAL)
    // Usamos useMemo para ordenar los platos por popularidad (totalVentas) 
    // solo cuando estemos en la vista "todos" y no haya una búsqueda activa.
    // 🔥 REEMPLAZA ESTE BLOQUE EN TU PRODUCTGRID
const platosFinales = useMemo(() => {
    // Si no hay platos, no procesamos nada
    if (!platosFiltrados || platosFiltrados.length === 0) return [];

    // Si hay búsqueda, mostramos tal cual vienen para no saturar el procesador
    if (busqueda.trim() !== "") return platosFiltrados;

    if (categoriaActiva === 'todos') {
        // Hacemos una copia rápida para ordenar
        const copia = [...platosFiltrados];
        return copia.sort((a, b) => {
            const vA = Number(a.totalVentas) || 0;
            const vB = Number(b.totalVentas) || 0;
            return vB - vA || (a.nombre || "").localeCompare(b.nombre || "");
        });
    }

    return platosFiltrados;
}, [platosFiltrados, busqueda, categoriaActiva]);
    return (
        <div className={styles.menuPanel}>
            {/* BOTONES DE NAVEGACIÓN SUPERIOR (MÓVIL) */}
            {!mostrarCarritoMobile && (
                <div className={styles.mobileSearchHeader}>
                    {/* CARRITO A LA IZQUIERDA */}
                    <button 
                        className={styles.mobileOrderBtn} 
                        onClick={(e) => {
                            e.stopPropagation();
                            setMostrarCarritoMobile(true);
                        }}
                    >
                        🛒
                    </button>
                    
                    {/* 🔍 BUSCADOR ESTILO GOOGLE (CENTRO) */}
                    <div className={styles.searchContainer}>
                        <input 
                            type="text" 
                            placeholder="Buscar plato..." 
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className={styles.searchInput}
                        />
                        {busqueda && (
                            <button onClick={() => setBusqueda('')} className={styles.clearBtn}>✕</button>
                        )}
                    </div>

                    {/* HAMBURGUESA / X A LA DERECHA */}
                    <button 
                        className={styles.mobileCatBtn} 
                        onClick={(e) => {
                            e.stopPropagation();
                            setMostrarCategoriasMobile(!mostrarCategoriasMobile);
                        }}
                    >
                        {mostrarCategoriasMobile ? '✕' : '☰'}
                    </button>
                </div>
            )}

            {/* Menú lateral de categorías */}
            <div className={`${styles.categoriesBar} ${mostrarCategoriasMobile ? styles.categoriesBarShowMobile : ''}`}>
                <h3 className={styles.mobileOnlyTitle}>Categorías</h3>
                {listaCategorias.map(cat => (
                    <button 
                        key={cat} 
                        className={`${styles.catBtn} ${categoriaActiva === cat ? styles.catBtnActive : ''}`} 
                        onClick={() => {
                            setCategoriaActiva(cat);
                            setMostrarCategoriasMobile(false);
                        }}>
                        {categoriasMap[cat] || cat}
                    </button>
                ))}
                {/* ⚙️ BOTÓN DE CONFIGURACIÓN DINÁMICO (SIEMPRE AL FINAL) */}
                    <button 
                        onClick={() => setMostrarConfigImpresion(true)}
                        className={styles.configBtnSidebar}
                        title="Configurar Estación"
                    >
                        <Settings size={20} />
                    </button>
                </div>

            {/* Cuadrícula de Platos con Diseño Split */}
            <div className={styles.productsGrid}>
                {platosFinales.map(plato => (
                    <div key={plato._id} className={styles.productCard} onClick={() => agregarAlCarrito(plato)}>
                        {/* 1. Área de Imagen */}
                        <div 
                            className={styles.cardImage} 
                            style={{ 
                                backgroundImage: plato.imagen 
                                    ? `url(${urlFor(plato.imagen).width(300).url()})` 
                                    : 'none',
                                backgroundColor: '#f3f4f6'
                            }}
                        />
                        
                        {/* 2. Área de Información */}
                        <div className={styles.cardInfo}>
                            <div className={styles.cardTitle}>{plato.nombre}</div>
                            <div className={styles.cardPrice}>
                                {SITE_CONFIG.brand.symbol}{formatPrecioDisplay(plato.precio).toLocaleString(SITE_CONFIG.brand.currency)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* BARRA INFERIOR DINÁMICA: ÉXITO > CARRITO > NAVEGACIÓN DE MESAS */}
            {(mensajeExito || (cart && cart.length > 0) || (ordenesActivas && ordenesActivas.length > 0)) && !mostrarCarritoMobile && (
                <div 
                    className={mensajeExito || cart.length > 0 ? styles.rappiCartBtn : styles.barraMesasActivas} 
                    style={{ 
                        backgroundColor: mensajeExito ? '#059669' : (cart.length > 0 ? '#10B981' : '#f8f9fa'),
                        borderTop: cart.length === 0 ? '1px solid #dee2e6' : 'none'
                    }}
                    onClick={() => {
                        if (!mensajeExito && cart.length > 0) setMostrarCarritoMobile(true);
                    }}
                >
                    {mensajeExito ? (
                        /* MODO 1: CONFIRMACIÓN DE ÉXITO */
                        <>
                            <div className={styles.rappiCount}>✓</div>
                            <div className={styles.rappiText}>¡ORDEN GUARDADA EXITOSAMENTE!</div>
                        </>
                    ) : cart.length > 0 ? (
                        /* MODO 2: CARRITO ACTIVO */
                        <>
                            <div className={styles.rappiCount}>
                            {/* ✅ Usamos item.cantidad que es el nombre real en tu Contexto */}
                            {cart.reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0)} 
                            {' '}
                            {/* ✅ Aquí también corregimos item.cantidad para la condición de texto */}
                            {cart.length === 1 && cart[0].cantidad === 1 ? 'Producto' : 'Productos'}
                           </div>
                            <div className={styles.rappiText}>Ver pedido</div>
                            {!mensajeExito && (
                                <div className={styles.rappiTotal}>
                                    {SITE_CONFIG.brand.symbol}{Number(total || 0).toLocaleString()}
                                </div>
                            )}
                        </>
                    ) : (
                        /* MODO 3: NAVEGACIÓN RÁPIDA DE MESAS */
                        <div className={styles.contenedorMesasRapidas}>
                        <span className={styles.etiquetaMesas}>MESAS ACTIVAS:</span>
                        <div className={styles.scrollMesas}>
                        {ordenesActivas && ordenesActivas.map((o) => (
                        <button 
                        key={o._id} 
                        className={`${styles.botonMesaRapida} ${ordenActivaId === o._id ? styles.tableBtnActive : ''}`} 
                        onClick={() => cargarOrden(o._id)}
                       >
                        {o.mesa}
                      </button>
                      ))}
                        </div>
                        </div>
                   )}
                </div>
            )}
            
        </div>
    );
});

ProductGrid.displayName = 'ProductGrid';

export default ProductGrid;