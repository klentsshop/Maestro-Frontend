'use client'; 

import React from 'react';
// ✅ Usamos el alias @ para asegurar que siempre encuentre el MenuPanel 
// sin importar si movemos este wrapper en el futuro.
import MenuPanel from '@/app/MenuPanel'; 

export default function ClientWrapper() {
  // Este componente actúa como el puente entre el servidor y el cliente
  return <MenuPanel />; 
}