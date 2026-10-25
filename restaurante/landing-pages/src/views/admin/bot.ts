import type { BlockOrigin } from '../../repositories/bot-control-store.ts';
import { DEFAULT_MANUAL_DURATION, MANUAL_DURATIONS, REASON_MAX_LENGTH, type BotControlSnapshot, type ManualDuration, type ReachedCap } from '../../services/bot-control.ts';
import type { UsageBlock } from '../../services/bot-usage.ts';
import type { BotProvider } from '../../services/whatsapp-bot/chat-bot.ts';
import { formatDisplayDate } from '../../utils/datetime.ts';
import type { Renderer, SafeHtml } from '../render.ts';
import { ADMIN_CLASSES, BOT_ADMIN_PATH, adminAttrs, adminFieldError, adminInvalidAttrs, adminPage, renderAdminNotice, type AdminPageContext } from './index.ts';

/**
 * Página "Bot" de /admin (REQ-F-025, RF-6), solo para administradores. Sin diseño fuente: mismos
 * patrones que el resto de /admin (HTML nativo, sin JavaScript, avisos accesibles). Nunca contiene
 * un número completo ni su seudónimo (CA-15): solo números enmascarados, ids de entrada y tokens
 * de un solo uso. El teléfono escrito nunca se vuelve a pintar.
 */

export const BOT_PATH = BOT_ADMIN_PATH;
export const BOT_SWITCH_PATH = `${BOT_PATH}/interruptor`;
export const BOT_BLOCKS_PATH = `${BOT_PATH}/bloqueos`;
export const botUnblockPath = (id: number): string => `${BOT_BLOCKS_PATH}/${id}/quitar`;
export const botReachedBlockPath = (token: string): string => `${BOT_PATH}/topes/${token}/bloquear`;

export const BOT_SUCCESS_MESSAGES = Object.freeze({
  paused: 'Bot pausado: no se envía ningún mensaje y los mensajes que lleguen se descartan.',
  resumed: 'Bot reanudado: vuelve a atender.',
  blocked: 'Número bloqueado.',
  unblocked: 'Bloqueo quitado: el número vuelve a ser atendido.',
});

const USAGE_LABELS: Readonly<Record<UsageBlock, string>> = Object.freeze({
  templates_day: 'Avisos al personal (hoy)',
  templates_month: 'Avisos al personal (mes)',
  outbound_day: 'Mensajes del bot (hoy)',
  outbound_month: 'Mensajes del bot (mes)',
  budget: 'Gasto estimado del mes (USD)',
});

const CAP_LABELS: Readonly<Record<ReachedCap, string>> = Object.freeze({
  orders: 'Pedidos del día',
  messages: 'Mensajes del día',
  cooldown: 'Mensajes repetidos',
  burst: 'Ráfaga de mensajes',
  minute: 'Mensajes por minuto',
});

const ORIGIN_LABELS: Readonly<Record<BlockOrigin, string>> = Object.freeze({
  manual: 'Manual',
  tope: 'Tope diario',
  repeticion: 'Repeticiones',
});

const STATE_CLASSES = Object.freeze({
  ok: 'bot-panel__state--ok font-semibold text-green-900',
  reached: 'bot-panel__state--reached font-bold text-red-800',
});

const FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  telefono: 'Número de WhatsApp',
  duracion: 'Duración',
  motivo: 'Motivo (opcional)',
});

export type BotFormErrors = Readonly<Partial<Record<'telefono' | 'duracion' | 'motivo', string>>>;

export interface BotPageOptions extends AdminPageContext {
  snapshot: BotControlSnapshot;
  timezone: string;
  provider: BotProvider | undefined;
  success?: string | undefined;
  problem?: string | undefined;
  /** Formulario de alta con errores: duración y motivo se conservan; el teléfono, nunca. */
  form?: { duration: string; reason: string; errors: BotFormErrors } | undefined;
  switchError?: string | undefined;
}

const usd = (micros: number): string => (micros / 1_000_000).toFixed(2);

const fieldIdOf = (name: string): string => `b-${name}`;

function renderNotices(renderer: Renderer, options: BotPageOptions): SafeHtml {
  const notices: SafeHtml[] = [];
  if (options.success) notices.push(renderAdminNotice(renderer, { tone: 'success', role: 'status', title: options.success }));
  if (options.problem) notices.push(renderAdminNotice(renderer, { tone: 'error', role: 'alert', title: options.problem }));
  const errors = Object.entries(options.form?.errors ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  if (errors.length > 0 || options.switchError) {
    const items = [
      ...errors.map(([name, message]) => ({ id: fieldIdOf(name), label: FIELD_LABELS[name] ?? name, message })),
      ...(options.switchError ? [{ id: 'b-motivo-interruptor', label: 'Motivo del interruptor', message: options.switchError }] : []),
    ];
    notices.push(
      renderAdminNotice(renderer, {
        tone: 'error',
        role: 'alert',
        title: `No se guardó nada: revisa ${items.length === 1 ? 'el campo marcado' : `los ${items.length} campos marcados`}.`,
        extra: renderer.render('admin/partials/error-list', { items: renderer.renderEach('admin/partials/error-summary-item', items) }),
      }),
    );
  }
  if (!options.snapshot.storeHealthy) {
    notices.push(
      renderAdminNotice(renderer, {
        tone: 'warning',
        role: 'status',
        title: 'La base de datos no respondió: se muestra la última copia conocida.',
        paragraphs: ['El bot sigue aplicando esa copia. Los cambios no se guardarán hasta que vuelva la base de datos.'],
      }),
    );
  }
  if (options.snapshot.previousKeyBlocks > 0) {
    notices.push(
      renderAdminNotice(renderer, {
        tone: 'warning',
        role: 'status',
        title: `${options.snapshot.previousKeyBlocks} bloqueo(s) siguen calculados con la clave anterior.`,
        paragraphs: ['No retires WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS mientras este número no sea 0: esos bloqueos dejarían de aplicarse.'],
      }),
    );
  }
  return renderer.join(notices);
}

function durationOptions(renderer: Renderer, selected: string): SafeHtml {
  return renderer.renderEach(
    'admin/partials/option-labeled',
    (Object.entries(MANUAL_DURATIONS) as [ManualDuration, { label: string }][]).map(([value, { label }]) => ({
      value,
      label,
      selected: adminAttrs(renderer, [['selected', value === selected]]),
    })),
  );
}

function renderTable(renderer: Renderer, caption: string, head: string[], rows: SafeHtml): SafeHtml {
  return renderer.render('admin/partials/bot-table', { caption, head: renderer.renderEach('admin/partials/bot-th', head.map((text) => ({ text }))), rows });
}

function renderAddForm(renderer: Renderer, options: BotPageOptions): SafeHtml {
  if (!options.snapshot.canBlock) {
    return renderer.render('admin/partials/bot-empty', {
      text: 'Para bloquear números, el bot debe estar configurado con su clave (WHATSAPP_BOT_BLOCKLIST_KEY).',
    });
  }
  const errors = options.form?.errors ?? {};
  const phoneId = fieldIdOf('telefono');
  const reasonId = fieldIdOf('motivo');
  const durationId = fieldIdOf('duracion');
  const phoneHint = `${phoneId}-hint`;
  const fields = [
    renderer.render('admin/partials/field-text', {
      id: phoneId,
      name: 'telefono',
      type: 'tel',
      label: FIELD_LABELS.telefono,
      // CA-15: el número nunca se devuelve en el HTML, ni siquiera tras un error.
      value: '',
      inputClass: ADMIN_CLASSES.input,
      hint: renderer.render('admin/partials/field-hint', { id: phoneHint, text: 'Con código de país (52 para México) o 10 dígitos de México.' }),
      error: adminFieldError(renderer, phoneId, errors.telefono),
      attrs: adminAttrs(renderer, [
        ['inputmode', 'tel'],
        ['autocomplete', 'off'],
        ['maxlength', '32'],
        ['spellcheck', 'false'],
        ['required', true],
        ...adminInvalidAttrs(phoneId, errors.telefono, phoneHint),
      ]),
    }),
    renderer.render('admin/partials/field-select', {
      id: durationId,
      name: 'duracion',
      label: FIELD_LABELS.duracion,
      inputClass: ADMIN_CLASSES.input,
      options: durationOptions(renderer, options.form?.duration ?? DEFAULT_MANUAL_DURATION),
      hint: renderer.join([]),
      error: adminFieldError(renderer, durationId, errors.duracion),
      attrs: adminAttrs(renderer, adminInvalidAttrs(durationId, errors.duracion)),
    }),
    renderer.render('admin/partials/field-text', {
      id: reasonId,
      name: 'motivo',
      type: 'text',
      label: FIELD_LABELS.motivo,
      value: options.form?.reason ?? '',
      inputClass: ADMIN_CLASSES.input,
      hint: renderer.join([]),
      error: adminFieldError(renderer, reasonId, errors.motivo),
      attrs: adminAttrs(renderer, [['maxlength', String(REASON_MAX_LENGTH)], ['autocomplete', 'off'], ...adminInvalidAttrs(reasonId, errors.motivo)]),
    }),
  ];
  return renderer.render('admin/partials/bot-add-form', {
    action: BOT_BLOCKS_PATH,
    csrfToken: options.csrfToken,
    fields: renderer.join(fields),
    buttonClass: ADMIN_CLASSES.primaryButton,
  });
}

/** Página "Bot" (RF-6). */
export function renderBotPage(renderer: Renderer, options: BotPageOptions): SafeHtml {
  const { snapshot, timezone, csrfToken } = options;
  const date = (value: Date): string => formatDisplayDate(value.toISOString(), timezone);
  const paused = snapshot.control.paused;
  const pausedDetail = snapshot.control.changedAt
    ? ` (cambió ${snapshot.control.changedByName ?? 'el sistema'} el ${date(snapshot.control.changedAt)}${snapshot.control.reason ? `; motivo: ${snapshot.control.reason}` : ''})`
    : '';

  const usageRows = renderer.renderEach(
    'admin/partials/bot-usage-row',
    snapshot.usage.statuses.map((status) => ({
      label: USAGE_LABELS[status.id],
      used: status.id === 'budget' ? usd(status.used) : String(status.used),
      limit: status.id === 'budget' ? usd(status.limit) : String(status.limit),
      state: status.reached ? 'Alcanzado' : 'Disponible',
      stateClass: status.reached ? STATE_CLASSES.reached : STATE_CLASSES.ok,
    })),
  );

  const reached =
    snapshot.reached.length === 0
      ? renderer.render('admin/partials/bot-empty', { text: 'Ningún número alcanzó un tope hoy.' })
      : renderTable(
          renderer,
          'Números que alcanzaron un tope hoy',
          ['Número', 'Tope', 'Hora', 'Acción'],
          renderer.renderEach(
            'admin/partials/bot-reached-row',
            snapshot.reached.map((entry, index) => ({
              masked: entry.masked,
              cap: CAP_LABELS[entry.cap],
              at: date(entry.at),
              action: botReachedBlockPath(entry.token),
              csrfToken,
              selectId: `b-tope-${index + 1}`,
              options: durationOptions(renderer, DEFAULT_MANUAL_DURATION),
              inputClass: ADMIN_CLASSES.input,
              buttonClass: ADMIN_CLASSES.secondaryButton,
            })),
          ),
        );

  const blocks =
    snapshot.blocks.length === 0
      ? renderer.render('admin/partials/bot-empty', { text: 'No hay números bloqueados.' })
      : renderTable(
          renderer,
          'Números bloqueados',
          ['Número', 'Origen', 'Motivo', 'Autor', 'Desde', 'Hasta', 'Acción'],
          renderer.renderEach(
            'admin/partials/bot-block-row',
            snapshot.blocks.map((block) => {
              const masked = `*********${block.last4}`;
              return {
                masked,
                origin: ORIGIN_LABELS[block.origin],
                reason: block.reason ?? '—',
                author: block.createdByName ?? 'Sistema',
                since: date(block.createdAt),
                until: block.expiresAt ? date(block.expiresAt) : 'Permanente',
                // Un alta automática aún sin guardar (base caída) no se puede quitar todavía.
                action:
                  block.id > 0
                    ? renderer.render('admin/partials/bot-unblock-form', { action: botUnblockPath(block.id), csrfToken, masked, buttonClass: ADMIN_CLASSES.secondaryButton })
                    : renderer.render('admin/partials/bot-pending', { text: 'Pendiente de guardar' }),
              };
            }),
          ),
        );

  return adminPage(renderer, {
    ...options,
    title: 'Bot',
    current: 'bot',
    body: renderer.render('admin/bot', {
      notices: renderNotices(renderer, options),
      botStatus: options.provider
        ? `Habilitado (${options.provider === 'meta' ? 'Meta' : 'Twilio'})`
        : 'Desactivado: sin configuración (el webhook responde 503). La lista negra y el interruptor quedan guardados para cuando se active.',
      pausedLabel: paused ? 'Bot pausado' : 'Bot activo',
      pausedDetail,
      switchAction: BOT_SWITCH_PATH,
      switchValue: paused ? 'reanudar' : 'pausar',
      switchLabel: paused ? 'Reanudar bot' : 'Pausar bot',
      switchButtonClass: paused ? `admin-button--primary ${ADMIN_CLASSES.primaryButton}` : `admin-button--secondary ${ADMIN_CLASSES.secondaryButton}`,
      switchReasonAttrs: adminAttrs(renderer, adminInvalidAttrs('b-motivo-interruptor', options.switchError)),
      switchReasonError: adminFieldError(renderer, 'b-motivo-interruptor', options.switchError),
      inputClass: ADMIN_CLASSES.input,
      csrfToken,
      dayPeriod: snapshot.usage.day.period,
      monthPeriod: snapshot.usage.month.period,
      timezone,
      usageRows,
      reached,
      blocks,
      addForm: renderAddForm(renderer, options),
    }),
  });
}
