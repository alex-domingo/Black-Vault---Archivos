import { ChangeDetectionStrategy, Component, effect, input, model, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RangoFechas } from '../../../nucleo/modelos/reportes';
import { aDia, deDia } from './fechas';

type Atajo = 'todo' | '30' | '90' | '180' | 'anio' | 'personalizado';

function rangoDeAtajo(atajo: Atajo): RangoFechas | null {
  const hoy = new Date();
  const hace = (dias: number) => aDia(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias + 1));
  switch (atajo) {
    case 'todo':
      return {};
    case '30':
    case '90':
    case '180':
      return { desde: hace(Number(atajo)), hasta: aDia(hoy) };
    case 'anio':
      return { desde: `${hoy.getFullYear()}-01-01`, hasta: aDia(hoy) };
    default:
      return null;
  }
}

/** Rango de fechas con atajos (últimos 30 días, este año…) o elegido en el calendario. */
@Component({
  selector: 'app-filtro-fechas',
  imports: [ReactiveFormsModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <mat-form-field class="atajo" subscriptSizing="dynamic">
      <mat-label>Período</mat-label>
      <mat-select [formControl]="atajo">
        <mat-option value="todo">Todo el tiempo</mat-option>
        <mat-option value="30">Últimos 30 días</mat-option>
        <mat-option value="90">Últimos 90 días</mat-option>
        <mat-option value="180">Últimos 6 meses</mat-option>
        <mat-option value="anio">Este año</mat-option>
        <mat-option value="personalizado">Personalizado</mat-option>
      </mat-select>
    </mat-form-field>
    <mat-form-field class="fechas" subscriptSizing="dynamic">
      <mat-label>Entre</mat-label>
      <mat-date-range-input [formGroup]="fechas" [rangePicker]="calendario">
        <input matStartDate formControlName="desde" placeholder="Desde" />
        <input matEndDate formControlName="hasta" placeholder="Hasta" />
      </mat-date-range-input>
      <mat-datepicker-toggle matIconSuffix [for]="calendario" />
      <mat-date-range-picker #calendario />
    </mat-form-field>
  `,
  styles: `
    :host {
      display: contents;
    }
    .atajo {
      width: 180px;
    }
    .fechas {
      width: 260px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiltroFechas {
  readonly rango = model<RangoFechas>({});
  /** Atajo con el que arranca el filtro. */
  readonly inicial = input<Atajo>('todo');

  protected readonly atajo = new FormControl<Atajo>('todo', { nonNullable: true });
  protected readonly fechas = new FormGroup({ desde: new FormControl<Date | null>(null), hasta: new FormControl<Date | null>(null) });
  private aplicando = false;

  constructor() {
    effect(() => {
      const inicial = this.inicial();
      untracked(() => {
        this.atajo.setValue(inicial, { emitEvent: false });
        this.aplicarAtajo(inicial);
      });
    });
    this.atajo.valueChanges.subscribe((a) => this.aplicarAtajo(a));
    this.fechas.valueChanges.subscribe(({ desde, hasta }) => {
      if (this.aplicando) return;
      // Solo se aplica cuando el rango está completo (o vacío).
      if ((desde && !hasta) || (!desde && hasta)) return;
      this.atajo.setValue('personalizado', { emitEvent: false });
      this.rango.set({ desde: aDia(desde), hasta: aDia(hasta) });
    });
  }

  private aplicarAtajo(atajo: Atajo): void {
    const rango = rangoDeAtajo(atajo);
    if (!rango) return;
    this.aplicando = true;
    this.fechas.setValue({ desde: deDia(rango.desde), hasta: deDia(rango.hasta) });
    this.aplicando = false;
    this.rango.set(rango);
  }
}
