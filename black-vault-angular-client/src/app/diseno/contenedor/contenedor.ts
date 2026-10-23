import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { Avatar } from '../../compartido/componentes/avatar/avatar';
import { Sesion } from '../../nucleo/servicios/sesion';
import { IndicadorEspacio } from '../indicador-espacio/indicador-espacio';
import { IndicadorServidor } from '../indicador-servidor/indicador-servidor';

interface EnlaceNavegacion {
  ruta: string;
  etiqueta: string;
  icono: string;
}

/** Estructura principal: barra superior, menú lateral y área de contenido. */
@Component({
  selector: 'app-contenedor',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule,
    IndicadorServidor,
    IndicadorEspacio,
    Avatar,
  ],
  templateUrl: './contenedor.html',
  styleUrl: './contenedor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contenedor {
  private readonly sesion = inject(Sesion);
  protected readonly usuario = this.sesion.usuario;
  protected readonly esAdministrador = this.sesion.esAdministrador;

  private readonly esPantallaPequena = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 959px)')
      .pipe(map((resultado) => resultado.matches)),
    { initialValue: false },
  );

  /** En pantallas pequeñas el menú se superpone y empieza cerrado. */
  protected readonly modoMenu = computed(() => (this.esPantallaPequena() ? 'over' : 'side'));
  private readonly menuAbiertoManual = signal<boolean | null>(null);
  protected readonly menuAbierto = computed(() => this.menuAbiertoManual() ?? !this.esPantallaPequena());

  protected readonly enlaces: EnlaceNavegacion[] = [
    { ruta: '/mi-unidad', etiqueta: 'Mi unidad', icono: 'folder' },
    { ruta: '/compartidos', etiqueta: 'Compartidos', icono: 'folder_shared' },
    { ruta: '/busqueda', etiqueta: 'Búsqueda', icono: 'search' },
    { ruta: '/papelera', etiqueta: 'Papelera', icono: 'delete' },
    { ruta: '/actividad', etiqueta: 'Actividad', icono: 'history' },
  ];

  protected readonly enlacesAdministracion: EnlaceNavegacion[] = [
    { ruta: '/administracion/usuarios', etiqueta: 'Usuarios', icono: 'manage_accounts' },
    { ruta: '/administracion/reportes', etiqueta: 'Reportes', icono: 'insights' },
  ];

  protected alternarMenu(): void {
    this.menuAbiertoManual.set(!this.menuAbierto());
  }

  /** Al navegar desde un menú superpuesto, se cierra. */
  protected alNavegar(): void {
    if (this.esPantallaPequena()) this.menuAbiertoManual.set(false);
  }

  protected cerrarSesion(): void {
    void this.sesion.cerrarSesion();
  }

  protected alCerrarMenu(): void {
    this.menuAbiertoManual.set(false);
  }
}
