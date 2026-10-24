import { ChangeDetectionStrategy, Component, effect, inject, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { catchError, map, of } from 'rxjs';
import { Usuario } from '../../../nucleo/modelos/usuario';
import { UsuariosApi } from '../../../nucleo/servicios/usuarios-api';

/** Lista de todos los usuarios (también los inactivos: su historial sigue siendo consultable). */
@Component({
  selector: 'app-selector-usuario',
  imports: [MatFormFieldModule, MatSelectModule],
  template: `
    <mat-form-field class="usuario" subscriptSizing="dynamic">
      <mat-label>Usuario</mat-label>
      <mat-select [value]="usuarioId()" (valueChange)="usuarioId.set($event)">
        @for (u of usuarios(); track u._id) {
          <mat-option [value]="u._id">
            {{ u.nombreCompleto }} ({{ u.nombreUsuario }}){{ u.activo ? '' : ' · inactivo' }}
          </mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styles: `
    .usuario {
      width: 320px;
      max-width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorUsuario {
  readonly usuarioId = model<string | null>(null);

  protected readonly usuarios = toSignal(
    inject(UsuariosApi)
      .listar({ pagina: 1, limite: 100 })
      .pipe(
        map((p) => p.datos.filter((u) => u.rol !== 'administrador')),
        catchError(() => of<Usuario[]>([])),
      ),
    { initialValue: [] as Usuario[] },
  );

  constructor() {
    // Sin elección previa, se toma el primer usuario para que el reporte no aparezca vacío.
    effect(() => {
      const lista = this.usuarios();
      if (!this.usuarioId() && lista.length) this.usuarioId.set(lista[0]._id);
    });
  }
}
