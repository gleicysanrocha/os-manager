export type PaymentStatus = 'Pago' | 'Pendente' | 'Pago Parcialmente';
export type PaymentMethod = 'Pix' | 'Dinheiro' | 'Parcelado' | '';

export interface ServiceType {
  id: string;
  name: string;
  osRequired: boolean;
}

export const DEFAULT_SERVICE_TYPES: ServiceType[] = [
  { id: 'default-os', name: 'Geração de OS', osRequired: true },
  { id: 'default-maintenance', name: 'Manutenção', osRequired: false },
  { id: 'default-other', name: 'Outros', osRequired: false },
];

export function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function parseCurrency(value: string) {
  const normalized = value.trim().replace(/\s/g, '');
  const decimalValue = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized;

  return Number(decimalValue);
}

export function normalizeServiceTypeName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

export function mergeServiceTypes(customTypes: ServiceType[]) {
  const typesByName = new Map<string, ServiceType>();

  for (const type of [...DEFAULT_SERVICE_TYPES, ...customTypes]) {
    const normalizedName = normalizeServiceTypeName(type.name);
    if (!typesByName.has(normalizedName)) {
      typesByName.set(normalizedName, {
        ...type,
        name: type.name.trim(),
      });
    }
  }

  return Array.from(typesByName.values());
}

export function isDefaultServiceType(type: ServiceType) {
  return DEFAULT_SERVICE_TYPES.some(
    (defaultType) => normalizeServiceTypeName(defaultType.name) === normalizeServiceTypeName(type.name),
  );
}

export function getReceivedAmount(
  value: number,
  status: PaymentStatus,
  partialAmountPaid?: number,
) {
  if (status === 'Pago') return value;
  if (status === 'Pago Parcialmente') return Math.min(value, Math.max(0, partialAmountPaid ?? 0));
  return 0;
}

export function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
