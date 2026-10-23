import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';

/** Campo de etiquetas con chips. Trabaja sobre un FormControl<string[]>. Mismas reglas que el servidor. */
@Component({
  selector: 'app-campo-etiquetas',
  imports: [MatFormFieldModule, MatChipsModule, MatIconModule],
  template: `
    <mat-form-field class="campo">
      <mat-label>Etiquetas</mat-label>
      <mat-chip-grid #grilla aria-label="Etiquetas">
        @for (etiqueta of control().value; track etiqueta) {
          <mat-chip-row (removed)="quitar(etiqueta)">
            {{ etiqueta }}
            <button matChipRemove [attr.aria-label]="'Quitar ' + etiqueta"><mat-icon>cancel</mat-icon></button>
          </mat-chip-row>
        }
        <input
          placeholder="Escribe y presiona Enter"
          [matChipInputFor]="grilla"
          [matChipInputSeparatorKeyCodes]="separadores"
          [matChipInputAddOnBlur]="true"
          (matChipInputTokenEnd)="agregar($event)"
        />
      </mat-chip-grid>
      <mat-hint>Máximo 20, de hasta 30 caracteres.</mat-hint>
    </mat-form-field>
  `,
  styles: `
    .campo {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampoEtiquetas {
  readonly control = input.required<FormControl<string[]>>();
  protected readonly separadores = [ENTER, COMMA] as const;

  protected agregar(evento: MatChipInputEvent): void {
    const valor = evento.value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 30);
    const actuales = this.control().value;
    if (valor && !actuales.includes(valor) && actuales.length < 20) {
      this.control().setValue([...actuales, valor]);
      this.control().markAsDirty();
    }
    evento.chipInput.clear();
  }

  protected quitar(etiqueta: string): void {
    this.control().setValue(this.control().value.filter((e) => e !== etiqueta));
    this.control().markAsDirty();
  }
}
