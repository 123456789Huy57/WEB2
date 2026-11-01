import { Pipe, PipeTransform } from '@angular/core';
import { vnd } from '../core/storage';

/** 37500 | vnd → "37.500 đ" */
@Pipe({ name: 'vnd' })
export class VndPipe implements PipeTransform {
  transform(n: number | null | undefined): string { return vnd(n ?? 0); }
}
