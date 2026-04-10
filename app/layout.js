import "./globals.css";
import { CartProvider } from './context/CartContext'; 
// 1. Importamos tu archivo de configuración
import { SITE_CONFIG } from '@/lib/config'; 

export const metadata = {
  // 2. Usamos el nombre exacto que definiste en SITE_CONFIG.brand.name
  title: `${SITE_CONFIG.brand.name} - POS`,
  description: `Sistema de ventas para ${SITE_CONFIG.brand.name}`,
};
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      {/* Quitamos las clases de Geist y usamos la clase antialiased estándar */}
      <body className="antialiased">
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}