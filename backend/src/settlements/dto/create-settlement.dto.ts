import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSettlementDto {
  @IsString()
  fromUserId: string;

  @IsString()
  toUserId: string;

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsString()
  note?: string;
}
