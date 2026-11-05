import { BOT_DEFAULT_DURATION, BOT_MANUAL_DURATIONS, BOT_REASON_MAX, type BotManualDuration, type BotState } from '@restaurante/contracts';
import type { SafeHtml } from '@restaurante/web';

import type { PageContext } from './index.ts';
import type { UserViewHelpers } from './users.ts';

/**
 * Pantalla "Bot" del admin nuevo (REQ-F-043): solo presenta lo que devuelve la API. Sin JavaScript
 * obligatorio y sin tablas: tarjetas en listas, como "Usuarios". Los topes son de solo lectura (D-1).
 *
 * El teléfono escrito nunca llega a estas vistas: ninguna recibe el valor y su campo se pinta vacío
 * siempre (RF-9 y D-4). Las claves de `errors` son las de la API (`phone`, `duration`, `reason` y '').
 */

export const BOT_PATH = '/bot';
export const BOT_SWITCH_PATH = `${BOT_PATH}/interruptor`;
export const BOT_BLOCKS_PATH = `${BOT_PATH}/bloqueos`;
export const botUnblockPath = (id: number): string => `${BOT_BLOCKS_PATH}/${id}/quitar`;
export const botReachedPath = (token: string): string => `${BOT_PATH}/topes/${encodeURIComponent(token)}/bloquear`;

type Usage = BotState['usage']['counters'][number];
type Reached = BotState['reached'][number];
type Block = BotState['blocks'][number];

const DURATION_LABELS: Readonly<Record<BotManualDuration, string>> = Object.freeze({ '24h': '24 horas', '7d': '7 días', '30d': '30 días', permanente: 'Permanente' });

const USAGE_LABELS: Readonly<Record<Usage['id'], string>> = Object.freeze({
  templates_day: 'Avisos al personal (hoy)',
  templates_month: 'Avisos al personal (mes)',
  outbound_day: 'Mensajes del bot (hoy)',
  outbound_month: 'Mensajes del bot (mes)',
  budget: 'Gasto estimado del mes (USD)',
});

const CAP_LABELS: Readonly<Record<Reached['cap'], string>> = Object.freeze({
  orders: 'Pedidos del día',
  messages: 'Mensajes del día',
  cooldown: 'Repeticiones',
  burst: 'Ráfaga',
  minute: 'Mensajes por minuto',
});

const ORIGIN_LABELS: Readonly<Record<Block['origin'], string>> = Object.freeze({ manual: 'Manual', tope: 'Tope diario', repeticion: 'Repeticiones' });

const PROVIDER_LABELS: Readonly<Record<NonNullable<BotState['status']['provider']>, string>> = Object.freeze({ meta: 'Meta', twilio: 'Twilio' });

const SWITCH_BUTTONS = Object.freeze({
  pausar: { label: 'Pausar bot', busyText: 'Pausando…', buttonModifier: 'button--danger', buttonClass: 'border-error text-error hover:bg-error/10' },
  reanudar: { label: 'Reanudar bot', busyText: 'Reanudando…', buttonModifier: 'button--secondary', buttonClass: 'border-adobo text-crema hover:bg-adobo/15' },
});

const USD_MICROS = 1_000_000;
const amount = (id: Usage['id'], value: number): string => (id === 'budget' ? (value / USD_MICROS).toFixed(2) : String(value));

const SUMMARY_LABELS: Readonly<Record<string, string>> = Object.freeze({ phone: 'Número de WhatsApp', duration: 'Duración', reason: 'Motivo' });
const FORM_IDS: Readonly<Record<string, string>> = Object.freeze({ phone: 'b-telefono', duration: 'b-duracion', reason: 'b-motivo' });
const SWITCH_REASON_ID = 'b-motivo-interruptor';
const reachedDurationId = (index: number): string => `b-duracion-tope-${index}`;
const reachedReasonId = (index: number): string => `b-motivo-tope-${index}`;

/** Formulario enviado con errores. El teléfono no está: vuelve vacío siempre (D-4). */
export interface BotFormValues {
  duration: string;
  reason: string;
}

export const EMPTY_BOT_FORM: BotFormValues = Object.freeze({ duration: BOT_DEFAULT_DURATION, reason: '' });

export interface BotPageView {
  /** Avisos del resultado de la acción, antes que los del estado. */
  notices?: SafeHtml[];
  /** Alta manual devuelta por la API. */
  form?: (BotFormValues & { errors: Record<string, string> }) | undefined;
  /** Bloqueo desde la lista devuelto por la API. */
  reachedForm?: (BotFormValues & { token: string; errors: Record<string, string> }) | undefined;
  /** Motivo del interruptor devuelto por la API. */
  switchForm?: { reason: string; errors: Record<string, string> } | undefined;
}

export function createBotViews({ render, join, attrs, page, notice, displayDate }: UserViewHelpers) {
  const empty = join([]);

  function field(id: string, help: string | null, error: string | undefined) {
    const describedBy = [help ? `${id}-help` : undefined, error ? `${id}-error` : undefined].filter(Boolean).join(' ');
    return {
      id,
      help: help ? render('partials/field-help', { id: `${id}-help`, text: help }) : empty,
      error: error ? render('partials/field-error', { id: `${id}-error`, message: error }) : empty,
      aria: [
        ['aria-invalid', error ? 'true' : undefined],
        ['aria-describedby', describedBy || undefined],
      ] as [string, string | undefined][],
    };
  }

  function reasonField(id: string, label: string, value: string, error: string | undefined): SafeHtml {
    const described = field(id, null, error);
    return render('partials/field-input', { ...described, name: 'motivo', label, optional: ' (opcional)', span: '', value, attrs: attrs([['maxlength', BOT_REASON_MAX], ['autocomplete', 'off'], ...described.aria]) });
  }

  function durationField(id: string, label: string, selected: string, error: string | undefined): SafeHtml {
    const described = field(id, null, error);
    return render('partials/field-select', {
      ...described,
      name: 'duracion',
      label,
      span: '',
      attrs: attrs(described.aria),
      options: join(BOT_MANUAL_DURATIONS.map((value) => render('partials/option', { value, label: DURATION_LABELS[value], selected: value === selected ? render('partials/selected') : empty }))),
    });
  }

  /** Alta manual. `value: ''` a propósito: no hay ningún dato que reciba el teléfono escrito (D-4). */
  function addForm(csrfToken: string, values: BotFormValues, errors: Record<string, string>): SafeHtml {
    const phone = field(FORM_IDS.phone as string, 'Con código de país (52 para México) o 10 dígitos de México.', errors.phone);
    return render('partials/bot-add-form', {
      action: BOT_BLOCKS_PATH,
      csrfToken,
      fields: join([
        render('partials/field-input', {
          ...phone,
          name: 'telefono',
          label: 'Número de WhatsApp',
          optional: '',
          span: '',
          value: '',
          attrs: attrs([['inputmode', 'tel'], ['autocomplete', 'off'], ['maxlength', 32], ['spellcheck', 'false'], ['required', true], ...phone.aria]),
        }),
        durationField(FORM_IDS.duration as string, 'Duración', values.duration, errors.duration),
        reasonField(FORM_IDS.reason as string, 'Motivo', values.reason, errors.reason),
      ]),
    });
  }

  function errorSummary(items: { id: string | undefined; label: string; message: string }[]): SafeHtml[] {
    if (items.length === 0) return [];
    return [
      notice({
        tone: 'error',
        title: 'No se guardó nada: revisa los campos marcados.',
        extra: render('partials/error-summary', {
          items: join(items.map(({ id, label, message }) => (id ? render('partials/error-summary-item', { id, label, message }) : render('partials/error-summary-text', { message })))),
        }),
      }),
    ];
  }

  function stateNotices(bot: BotState): SafeHtml[] {
    return [
      ...(bot.storeHealthy
        ? []
        : [notice({ tone: 'warning', title: 'La base de datos no respondió: se muestra la última copia conocida.', paragraphs: ['El bot sigue aplicando esa copia. Los cambios no se guardarán hasta que vuelva la base de datos.'] })]),
      ...(bot.previousKeyBlocks > 0
        ? [
            notice({
              tone: 'warning',
              title: `${bot.previousKeyBlocks} bloqueo(s) siguen calculados con la clave anterior.`,
              paragraphs: ['No retires WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS mientras este número no sea 0: esos bloqueos dejarían de aplicarse.'],
            }),
          ]
        : []),
    ];
  }

  function statusDetails(bot: BotState): SafeHtml {
    const { status, control } = bot;
    const detail = (term: string, value: string, stateClass = '') => render('partials/bot-detail', { term, value, stateClass });
    return join([
      detail('Bot:', status.provider ? `Habilitado (${PROVIDER_LABELS[status.provider]})` : 'Desactivado'),
      detail('Interruptor:', control.paused ? 'Pausado' : 'Activo', control.paused ? 'font-bold text-error' : 'font-semibold text-maiz'),
      ...(control.changedAt ? [detail('Último cambio:', `${control.changedByName ?? 'El sistema'}, ${displayDate(control.changedAt)}`)] : []),
      ...(control.reason ? [detail('Motivo:', control.reason)] : []),
    ]);
  }

  function reachedRows(bot: BotState, context: PageContext, form: BotPageView['reachedForm']): SafeHtml {
    if (bot.reached.length === 0) return render('partials/empty', { text: 'Hoy ningún número ha alcanzado un tope.' });
    return render('partials/bot-list', {
      items: join(
        bot.reached.map((entry, index) => {
          const current = form?.token === entry.token ? form : undefined;
          const cap = CAP_LABELS[entry.cap];
          // Etiquetas únicas por fila: un número puede aparecer con varios topes.
          const row = `${entry.masked}, ${cap}`;
          return render('partials/bot-reached-row', {
            masked: entry.masked,
            cap,
            at: displayDate(entry.at),
            row,
            action: botReachedPath(entry.token),
            csrfToken: context.csrfToken,
            fields: join([
              durationField(reachedDurationId(index), `Duración para ${row}`, current?.duration ?? BOT_DEFAULT_DURATION, current?.errors.duration),
              reasonField(reachedReasonId(index), `Motivo para ${row}`, current?.reason ?? '', current?.errors.reason),
            ]),
          });
        }),
      ),
    });
  }

  function blockRows(bot: BotState, context: PageContext): SafeHtml {
    if (bot.blocks.length === 0) return render('partials/empty', { text: 'No hay números bloqueados.' });
    return render('partials/bot-list', {
      items: join(
        bot.blocks.map((block) =>
          render('partials/bot-block-row', {
            masked: block.masked,
            origin: ORIGIN_LABELS[block.origin],
            reason: block.reason ?? '—',
            author: block.author ?? 'Sistema',
            since: displayDate(block.since),
            until: block.until ? displayDate(block.until) : 'Permanente',
            // Un alta automática aún sin guardar (base caída) no se puede quitar todavía (RF-6).
            action:
              block.id === null
                ? render('partials/bot-pending')
                : render('partials/bot-unblock-form', { action: botUnblockPath(block.id), csrfToken: context.csrfToken, masked: block.masked }),
          }),
        ),
      ),
    });
  }

  function viewErrors(bot: BotState, { form, reachedForm, switchForm }: BotPageView): SafeHtml[] {
    const reachedIndex = reachedForm ? bot.reached.findIndex((entry) => entry.token === reachedForm.token) : -1;
    const reachedIds: Record<string, string | undefined> = reachedIndex < 0 ? {} : { duration: reachedDurationId(reachedIndex), reason: reachedReasonId(reachedIndex) };
    const items = (errors: Record<string, string>, ids: Readonly<Record<string, string | undefined>>) =>
      Object.entries(errors).map(([name, message]) => ({ id: ids[name], label: SUMMARY_LABELS[name] ?? name, message }));
    return errorSummary([...items(form?.errors ?? {}, bot.canBlock ? FORM_IDS : {}), ...items(reachedForm?.errors ?? {}, reachedIds), ...items(switchForm?.errors ?? {}, { reason: SWITCH_REASON_ID })]);
  }

  return {
    bot(context: PageContext, bot: BotState, view: BotPageView = {}): SafeHtml {
      const { notices = [], form, reachedForm, switchForm } = view;
      const action = bot.control.paused ? 'reanudar' : 'pausar';
      return page({
        title: 'Bot',
        context,
        section: 'bot',
        body: render('pages/bot', {
          notices: join([...notices, ...viewErrors(bot, view), ...stateNotices(bot)]),
          status: statusDetails(bot),
          switchForm: render('partials/bot-switch-form', {
            ...SWITCH_BUTTONS[action],
            action: BOT_SWITCH_PATH,
            csrfToken: context.csrfToken,
            value: action,
            reason: reasonField(SWITCH_REASON_ID, action === 'pausar' ? 'Motivo de la pausa' : 'Motivo de la reanudación', switchForm?.reason ?? '', switchForm?.errors.reason),
          }),
          day: bot.usage.day,
          month: bot.usage.month,
          timeZone: bot.usage.timeZone,
          usage: join(
            bot.usage.counters.map(({ id, used, limit, reached }) =>
              render('partials/bot-usage-row', {
                label: USAGE_LABELS[id],
                used: amount(id, used),
                limit: amount(id, limit),
                state: reached ? 'Alcanzado' : 'Disponible',
                stateClass: reached ? 'font-bold text-error' : 'font-semibold text-maiz',
              }),
            ),
          ),
          reached: reachedRows(bot, context, reachedForm),
          blocks: blockRows(bot, context),
          add: bot.canBlock ? addForm(context.csrfToken, form ?? EMPTY_BOT_FORM, form?.errors ?? {}) : render('partials/empty', { text: 'Para bloquear números, el bot debe estar configurado con su clave (WHATSAPP_BOT_BLOCKLIST_KEY).' }),
        }),
      });
    },

    /** Alta suelta, para cuando no se pudo leer el estado: conserva duración y motivo, nunca el teléfono (D-4). */
    botBlockForm({ context, csrfToken, values, notices }: { context: PageContext | null; csrfToken: string; values: BotFormValues; notices: SafeHtml[] }): SafeHtml {
      return page({
        title: 'Bot',
        ...(context ? { context } : {}),
        section: 'bot',
        body: render('pages/bot-block-form', { notices: join(notices), add: addForm(csrfToken, values, {}), statusHref: BOT_PATH }),
      });
    },
  };
}
