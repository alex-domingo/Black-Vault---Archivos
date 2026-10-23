import { Routes } from '@angular/router';
import { confirmarCambiosSinGuardar } from './nucleo/guardias/cambios-sin-guardar.guard';
import { requiereAdministrador, requiereSesion, soloSinSesion } from './nucleo/guardias/sesion.guard';

/** Las secciones se cargan bajo demanda (lazy loading) para mantener pequeño el bundle inicial. */
const enConstruccion = () => import('./paginas/en-construccion/en-construccion').then((m) => m.EnConstruccion);

export const routes: Routes = [
  {
    path: 'iniciar-sesion',
    title: 'Iniciar sesión · Black Vault',
    canActivate: [soloSinSesion],
    loadComponent: () => import('./paginas/inicio-sesion/inicio-sesion').then((m) => m.InicioSesion),
  },
  {
    path: '',
    canActivate: [requiereSesion],
    loadComponent: () => import('./diseno/contenedor/contenedor').then((m) => m.Contenedor),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'mi-unidad' },
      {
        path: 'mi-unidad',
        title: 'Mi unidad · Black Vault',
        loadComponent: () => import('./paginas/mi-unidad/mi-unidad').then((m) => m.MiUnidad),
      },
      {
        path: 'mi-unidad/carpeta/:id',
        title: 'Carpeta · Black Vault',
        loadComponent: () => import('./paginas/mi-unidad/mi-unidad').then((m) => m.MiUnidad),
      },
      {
        path: 'archivo/:id',
        title: 'Documento · Black Vault',
        loadComponent: () => import('./paginas/visor/visor').then((m) => m.Visor),
        canDeactivate: [confirmarCambiosSinGuardar],
      },
      {
        path: 'compartidos',
        title: 'Compartidos · Black Vault',
        loadComponent: () => import('./paginas/compartidos/compartidos').then((m) => m.Compartidos),
      },
      {
        // Carpetas de otras personas: el mismo explorador, bajo la sección "Compartidos".
        path: 'compartidos/carpeta/:id',
        title: 'Carpeta compartida · Black Vault',
        loadComponent: () => import('./paginas/mi-unidad/mi-unidad').then((m) => m.MiUnidad),
      },
      {
        path: 'busqueda',
        title: 'Búsqueda · Black Vault',
        loadComponent: () => import('./paginas/busqueda/busqueda').then((m) => m.Busqueda),
      },
      {
        path: 'papelera',
        title: 'Papelera · Black Vault',
        loadComponent: enConstruccion,
        data: {
          titulo: 'Papelera',
          icono: 'delete',
          fase: 5,
          descripcion: 'Restaura o elimina definitivamente lo que enviaste a la papelera.',
        },
      },
      {
        path: 'actividad',
        title: 'Actividad · Black Vault',
        loadComponent: enConstruccion,
        data: {
          titulo: 'Actividad',
          icono: 'history',
          fase: 5,
          descripcion: 'Historial de lo que hiciste y de lo que otros hicieron con tus archivos y carpetas.',
        },
      },
      {
        path: 'perfil',
        title: 'Mi perfil · Black Vault',
        loadComponent: () => import('./paginas/perfil/perfil').then((m) => m.Perfil),
      },
      {
        path: 'administracion/usuarios',
        title: 'Usuarios · Black Vault',
        canActivate: [requiereAdministrador],
        loadComponent: () => import('./paginas/administracion/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'administracion/reportes',
        title: 'Reportes · Black Vault',
        canActivate: [requiereAdministrador],
        loadComponent: enConstruccion,
        data: {
          titulo: 'Reportes',
          icono: 'insights',
          fase: 6,
          descripcion: 'Los 12 reportes de archivos, usuarios, comparticiones y actividad, con filtros y gráficas.',
        },
      },
      {
        path: '**',
        title: 'Página no encontrada · Black Vault',
        loadComponent: () => import('./paginas/no-encontrada/no-encontrada').then((m) => m.NoEncontrada),
      },
    ],
  },
];
