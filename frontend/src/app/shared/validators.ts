import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Custom Validator (Chương V): kiểm tra mà Validators có sẵn của Angular không làm được.
 * Mỗi hàm trả về null khi hợp lệ, hoặc một object lỗi để template hiện thông báo phù hợp.
 */

/** Họ tên người: chỉ chữ cái (có dấu tiếng Việt), khoảng trắng, dấu chấm, gạch nối, nháy đơn. Không số, không @ ? # … */
export function personNameValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) return null; // để Validators.required báo thiếu
    return /^[\p{L}\p{M}\s.'-]+$/u.test(value) ? null : { personName: { value } };
  };
}

/**
 * Số điện thoại Việt Nam: 10 số, bắt đầu bằng 0 và đầu số hợp lệ (di động 03, 05, 07, 08, 09; cố định 02).
 * Cho phép người dùng gõ có khoảng trắng hoặc dấu chấm: "090 123 4567".
 */
export function vnPhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = String(control.value ?? '').trim();
    if (!raw) return null;
    const digits = raw.replace(/[\s.]/g, '');
    if (!/^\d+$/.test(digits)) return { vnPhone: { reason: 'digits' } };
    if (digits.length !== 10) return { vnPhone: { reason: 'length', actual: digits.length } };
    return /^0[235789]/.test(digits) ? null : { vnPhone: { reason: 'prefix' } };
  };
}
/** Bỏ khoảng trắng/dấu chấm trước khi gửi lên server */
export const normalizePhone = (value: string): string => value.replace(/[\s.]/g, '');

/**
 * Cross-Field Validation: hai ô phải trùng nhau (mật khẩu mới và nhập lại).
 * Gắn ở cấp FormGroup vì một FormControl chỉ biết giá trị của chính nó.
 */
export function matchFieldsValidator(field: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(field)?.value, b = group.get(confirmField)?.value;
    return a && b && a !== b ? { fieldsMismatch: { field, confirmField } } : null;
  };
}

/** Thông báo tiếng Việt cho lỗi số điện thoại */
export function phoneMessage(errors: ValidationErrors | null | undefined): string {
  const e = errors?.['vnPhone'];
  if (errors?.['required']) return 'Nhập số điện thoại người nhận';
  if (!e) return '';
  if (e.reason === 'digits') return 'Số điện thoại chỉ gồm chữ số';
  if (e.reason === 'length') return `Số điện thoại cần 10 số (đang có ${e.actual})`;
  return 'Đầu số không hợp lệ (di động 03, 05, 07, 08, 09 hoặc cố định 02)';
}
