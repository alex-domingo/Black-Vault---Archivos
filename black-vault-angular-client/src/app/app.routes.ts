import { Routes } from '@angular/router';
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
        loadComponent: enConstruccion,
        data: {
          titulo: 'Mi unidad',
          icono: 'folder',
          fase: 3,
          descripcion: 'Tus carpetas y archivos .txt y .md: subir, descargar, consultar, renombrar, mover y organizar.',
        },
      },
      {
        path: 'compartidos',
        title: 'Compartidos · Black Vault',
        loadComponent: enConstruccion,
        data: {
          titulo: 'Compartidos',
          icono: 'folder_shared',
          fase: 4,
          descripcion: 'Archivos y carpetas que otros usuarios compartieron contigo y los que tú compartiste.',
        },
      },
      {
        path: 'busqueda',
        title: 'Búsqueda · Black Vault',
        loadComponent: enConstruccion,
        data: {
          titulo: 'Búsqueda',
          icono: 'search',
          fase: 3,
          descripcion: 'Busca por nombre, etiquetas, categoría, tipo y fecha en tus archivos y en los compartidos.',
        },
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
