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
 * Aplica máscara de CNPJ no formato 00.000.000/0000-00
 */
export function formatCNPJ(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Valida CNPJ brasileiro verificando comprimento, dígitos repetidos e 2 dígitos verificadores
 */
export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);

  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base: string, weights: number[]) => {
    const sum = weights.reduce(
      (acc, weight, idx) => acc + Number(base[idx]) * weight,
      0,
    );
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const firstDigit = calcDigit(cnpj.slice(0, 12), [
    5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2,
  ]);
  if (firstDigit !== Number(cnpj[12])) return false;

  const secondDigit = calcDigit(cnpj.slice(0, 13), [
    6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2,
  ]);
  return secondDigit === Number(cnpj[13]);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
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

export interface CondominiumFieldErrors {
  name?: string;
  cnpj?: string;
  address?: string;
  contactEmail?: string;
}

export function validateCondominiumFields(data: {
  name: string;
  cnpj: string;
  address: string;
  contactEmail: string;
}): CondominiumFieldErrors {
  const errors: CondominiumFieldErrors = {};

  if (data.name.trim().length < 3) {
    errors.name = "Informe o nome do condomínio (mínimo 3 caracteres).";
  }

  if (!isValidCNPJ(data.cnpj)) {
    errors.cnpj = "Digite um CNPJ válido (14 dígitos).";
  }

  if (data.address.trim().length < 5) {
    errors.address = "Informe o endereço completo do condomínio.";
  }

  if (!isValidEmail(data.contactEmail)) {
    errors.contactEmail = "Digite um e-mail válido do síndico ou condomínio.";
  }

  return errors;
}

export function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "Morador";
  const first = fullName.trim().split(/\s+/)[0];
  return first || "Morador";
}

/**
 * Extrai o token de convite mesmo se o usuário colar o link completo
 */
export function extractInviteToken(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const match = trimmed.match(/\/convite\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) return match[1];

  const queryMatch = trimmed.match(/[?&]convite=([a-zA-Z0-9_-]+)/i);
  if (queryMatch && queryMatch[1]) return queryMatch[1];

  return trimmed;
}
