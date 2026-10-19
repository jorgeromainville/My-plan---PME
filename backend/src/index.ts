import 'dotenv/config';
import { buildApp } from './app';

const PORT = Number(process.env.PORT ?? 4000);
buildApp().listen(PORT, () => console.log(`API en http://localhost:${PORT}`));
