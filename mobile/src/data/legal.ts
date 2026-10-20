// Texto legal de la app. Mantener en sintonía con docs/legal/*.md.
export const LEGAL_UPDATED = '19 de octubre de 2026';
export const LEGAL_CONTACT = 'soporte@myplan.today';

export interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export const privacySections: LegalSection[] = [
  {
    title: '1. Quién trata tus datos',
    paragraphs: [
      'My Plan es una aplicación de organización personal desarrollada por el equipo de My Plan (Perú). Para cualquier consulta sobre esta política o sobre tus datos, escribe a ' +
        LEGAL_CONTACT +
        '.',
    ],
  },
  {
    title: '2. Qué datos guardamos',
    paragraphs: ['Solo guardamos lo necesario para que la app funcione:'],
    bullets: [
      'Cuenta: nombre, correo electrónico y contraseña cifrada (bcrypt) o inicio de sesión con Google, si eliges esa opción. El teléfono es opcional.',
      'Preferencias: moneda, tema, inicio de semana, recordatorios y país de feriados.',
      'Contenido que creas: contactos, ingresos y gastos (importes, categorías, fechas), tareas, eventos, metas, lugares con coordenadas y notas.',
      'Registros técnicos: fecha, hora, IP y ruta de las peticiones, para seguridad y diagnóstico.',
    ],
  },
  {
    title: '3. Qué NO guardamos',
    paragraphs: ['Hay datos que la app usa pero no almacena:'],
    bullets: [
      'Fotos del escáner: la imagen se envía solo para extraer el texto, se procesa en memoria y se descarta. El archivo temporal se borra del teléfono y no se guarda en el servidor ni en la galería.',
      'Ubicación en tiempo real: solo se consulta cuando pulsas «Mi ubicación» o eliges un punto en el mapa. No hay seguimiento continuo en segundo plano.',
      'Agenda del teléfono: no se lee.',
      'No usamos publicidad, no vendemos datos y no incluimos SDKs de analítica.',
    ],
  },
  {
    title: '4. Para qué los usamos',
    paragraphs: [
      'Prestar el servicio y sincronizar tus datos entre sesiones; calcular resúmenes, estadísticas y metas; programar recordatorios locales; proteger la cuenta (límite de intentos y sesiones) y responder a soporte. No tomamos decisiones automatizadas con efectos legales.',
    ],
  },
  {
    title: '5. Con quién se comparten',
    paragraphs: [
      'El contenido se guarda en el servidor del servicio. Solo se envían datos a terceros cuando usas una función que los necesita:',
    ],
    bullets: [
      'Google: inicio de sesión, solo si eliges «Continuar con Google» (no recibe el contenido que creas).',
      'OCR.space: imagen del horario para extraer texto.',
      'Google Gemini: imagen del horario para interpretarla, si la IA está activa.',
      'OpenFreeMap: teselas del mapa.',
      'Open-Meteo: clima (coordenadas aproximadas del lugar consultado).',
      'Nager.Date: feriados por país y año.',
      'Estos proveedores tienen sus propias políticas. No se venden ni se ceden datos a anunciantes.',
    ],
  },
  {
    title: '6. Base legal y conservación',
    paragraphs: [
      'Tratamos los datos con tu consentimiento y para ejecutar el servicio (Ley 29733 de Protección de Datos Personales, Perú). Conservamos la cuenta y su contenido hasta que la elimines. Los registros técnicos se conservan por periodos cortos y las copias de seguridad pueden tardar unos días en rotar.',
    ],
  },
  {
    title: '7. Seguridad',
    paragraphs: [
      'Contraseñas cifradas con bcrypt o acceso mediante Google, sesiones con tokens de corta duración, límite de intentos de acceso y comunicación cifrada con HTTPS en producción. Ningún sistema es infalible: si detectas un problema, escríbenos.',
    ],
  },
  {
    title: '8. Tus derechos',
    paragraphs: [
      'Puedes acceder, corregir y eliminar tus datos. Desde Perfil puedes cambiar tu nombre, contraseña y preferencias, y eliminar la cuenta completa en Perfil → Eliminar cuenta (se borra en cascada). También puedes escribir a ' +
        LEGAL_CONTACT +
        '. Responderemos en un plazo razonable.',
    ],
  },
  {
    title: '9. Menores',
    paragraphs: [
      'El servicio no está dirigido a menores de 14 años. Si crees que un menor nos dio datos, escríbenos y los eliminaremos.',
    ],
  },
  {
    title: '10. Cambios',
    paragraphs: [
      'Podemos actualizar esta política. Publicaremos la nueva versión en la app con su fecha. Si el cambio es importante, lo avisaremos dentro de la app.',
    ],
  },
  {
    title: '11. Contacto',
    paragraphs: ['My Plan · Perú · ' + LEGAL_CONTACT],
  },
];

export const termsSections: LegalSection[] = [
  {
    title: '1. Aceptación',
    paragraphs: [
      'Al crear una cuenta o usar My Plan aceptas estos términos y la política de privacidad. Si no estás de acuerdo, no uses el servicio.',
    ],
  },
  {
    title: '2. Descripción del servicio',
    paragraphs: [
      'My Plan te ayuda a organizar tu día, agenda, ingresos y gastos, metas, contactos y lugares, con recordatorios locales y un escáner de horarios. El servicio puede cambiar o interrumpirse mientras está en desarrollo. Por ahora es gratuito; si en el futuro hay funciones de pago, se avisará antes.',
    ],
  },
  {
    title: '3. Tu cuenta',
    paragraphs: [
      'Debes ser mayor de 14 años y dar datos veraces. Eres responsable de tu contraseña y de la actividad de tu cuenta. Avísanos de cualquier uso no autorizado.',
    ],
  },
  {
    title: '4. Uso aceptable',
    paragraphs: ['No está permitido:'],
    bullets: [
      'Usar el servicio para fines ilegales o para dañar a terceros.',
      'Intentar acceder a cuentas ajenas o eludir los límites de seguridad.',
      'Automatizar peticiones que saturen o dañen el servicio.',
      'Subir contenido que viole derechos de autor, privacidad o cualquier derecho de terceros.',
    ],
  },
  {
    title: '5. Tu contenido',
    paragraphs: [
      'Los datos que creas son tuyos. Nos das permiso solo para almacenarlos, sincronizarlos y mostrarlos con el fin de prestarte el servicio.',
    ],
  },
  {
    title: '6. No es asesoría financiera',
    paragraphs: [
      'Los importes, resúmenes y metas son informativos. No somos asesores financieros ni respondemos por decisiones tomadas con base en ellos.',
    ],
  },
  {
    title: '7. Servicios de terceros',
    paragraphs: [
      'Mapas, clima, feriados y escáner usan proveedores externos; su disponibilidad y exactitud no dependen de nosotros.',
    ],
  },
  {
    title: '8. Disponibilidad',
    paragraphs: [
      'El servicio se ofrece «tal cual» y puede tener interrupciones, errores o pérdida de datos si falla el servidor. Te recomendamos mantener tu propia copia de la información importante.',
    ],
  },
  {
    title: '9. Límite de responsabilidad',
    paragraphs: [
      'En la medida permitida por la ley, no respondemos por daños indirectos, lucro cesante o pérdida de datos derivados del uso del servicio.',
    ],
  },
  {
    title: '10. Terminación',
    paragraphs: [
      'Puedes eliminar tu cuenta cuando quieras desde Perfil → Eliminar cuenta. Podemos suspender cuentas que incumplan estos términos o abusen del servicio.',
    ],
  },
  {
    title: '11. Ley aplicable',
    paragraphs: ['Estos términos se rigen por las leyes de la República del Perú.'],
  },
  {
    title: '12. Contacto',
    paragraphs: ['My Plan · Perú · ' + LEGAL_CONTACT],
  },
];
