import { useRouter } from 'expo-router';
// Ruta fantasma para el slot central: redirige a modal y no renderiza nada.
export default function Plus() {
  const router = useRouter();
  router.replace('/nuevo-registro');
  return null;
}
