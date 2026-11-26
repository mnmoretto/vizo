export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Aplica máscara de CPF no formato 000.000.000-00
 */
export function formatCPF(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Valida CPF brasileiro verificando comprimento, sequência repetida e dígitos verificadores
 */
export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(cpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(cpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;

  return remainder === Number(cpf[10]);
}

/**
 * Aplica máscara de telefone/WhatsApp brasileiro:
 * (00) 0000-0000 para 10 dígitos ou (00) 00000-0000 para 11 dígitos
 */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 10 && digits.length !== 11) return false;
  // DDD válido entre 11 e 99
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  // Rejeita números todos iguais após o DDD
  if (/^(\d)\1+$/.test(digits.slice(2))) return false;
  return true;
}

export function isValidFullName(value: string): boolean {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(" ").filter((part) => part.length >= 2);
  return trimmed.length >= 5 && parts.length >= 2;
}

export interface OnboardingFieldErrors {
  fullName?: string;
  cpf?: string;
  phone?: string;
  block?: string;
  unit?: string;
}

export function validateOnboardingFields(data: {
  fullName: string;
  cpf: string;
  phone: string;
  block: string;
  unit: string;
}): OnboardingFieldErrors {
  const errors: OnboardingFieldErrors = {};

  if (!isValidFullName(data.fullName)) {
    errors.fullName = "Informe seu nome e sobrenome.";
  }

  if (!isValidCPF(data.cpf)) {
    errors.cpf = "Digite um CPF válido (11 dígitos).";
  }

  if (!isValidPhone(data.phone)) {
    errors.phone = "Digite um telefone/WhatsApp válido com DDD.";
  }

  if (data.block.trim().length < 1) {
    errors.block = 'Informe o bloco, torre ou "Casa".';
  }

  if (data.unit.trim().length < 1) {
    errors.unit = "Informe o número do apartamento ou casa.";
  }

  return errors;
}

export function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "Morador";
  const first = fullName.trim().split(/\s+/)[0];
  return first || "Morador";
}
