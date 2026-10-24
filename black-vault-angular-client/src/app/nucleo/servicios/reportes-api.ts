import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccionPrincipal,
  ActividadDeUsuario,
  ArchivoCompartido,
  ArchivoConOperaciones,
  ArchivosPorFecha,
  ArchivosPorTipo,
  ComparticionesDeUsuario,
  OperacionesPorPeriodo,
  OperacionesPorTipo,
  Resumen,
  UsuarioConArchivos,
  UsuarioQueComparte,
} from '../modelos/reportes';

/** Filtros de un reporte: los vacíos no se envían. */
type Parametros = object;

/** Endpoints de /api/reportes (solo administrador). */
@Injectable({ providedIn: 'root' })
export class ReportesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.urlApi}/reportes`;

  private obtener<T>(ruta: string, parametros: Parametros = {}): Observable<T> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(parametros) as [string, unknown][]) {
      if (valor !== undefined && valor !== null && valor !== '') params = params.set(clave, String(valor));
    }
    return this.http.get<T>(`${this.url}/${ruta}`, { params });
  }

  resumen = () => this.obtener<Resumen>('resumen');
  archivosPorTipo = (p: Parametros) => this.obtener<ArchivosPorTipo>('archivos-por-tipo', p);
  archivosPorFecha = (p: Parametros) => this.obtener<ArchivosPorFecha>('archivos-por-fecha', p);
  archivosMasOperaciones = (p: Parametros) => this.obtener<ArchivoConOperaciones[]>('archivos-mas-operaciones', p);
  usuariosMasArchivos = (p: Parametros) => this.obtener<UsuarioConArchivos[]>('usuarios-mas-archivos', p);
  usuariosMasCompartidos = (p: Parametros) => this.obtener<UsuarioQueComparte[]>('usuarios-mas-compartidos', p);
  archivosMasCompartidos = (p: Parametros) => this.obtener<ArchivoCompartido[]>('archivos-mas-compartidos', p);
  compartidosPorUsuario = (usuarioId: string, p: Parametros) => this.obtener<ComparticionesDeUsuario>(`compartidos-por-usuario/${usuarioId}`, p);
  recibidosPorUsuario = (usuarioId: string, p: Parametros) => this.obtener<ComparticionesDeUsuario>(`recibidos-por-usuario/${usuarioId}`, p);
  actividadUsuario = (usuarioId: string, p: Parametros) => this.obtener<ActividadDeUsuario>(`actividad-usuario/${usuarioId}`, p);
  operacionesPorTipo = (p: Parametros) => this.obtener<OperacionesPorTipo>('operaciones-por-tipo', p);
  operacionesPorPeriodo = (p: Parametros) => this.obtener<OperacionesPorPeriodo>('operaciones-por-periodo', p);
  principalesAcciones = (p: Parametros) => this.obtener<AccionPrincipal[]>('principales-acciones', p);
}
