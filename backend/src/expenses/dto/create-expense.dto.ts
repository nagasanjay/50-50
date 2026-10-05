import { IsIn, IsInt, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { SplitInput, SplitType } from '../split.util';

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  description: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsIn(['EQUAL', 'EXACT', 'PERCENTAGE'])
  splitType: SplitType;

  @IsString()
  paidById: string;

  @IsOptional()
  @IsString()
  incurredAt?: string;

  @IsObject()
  participants: SplitInput;
}
