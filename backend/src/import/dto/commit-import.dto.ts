import { IsObject, IsString, MinLength } from 'class-validator';

export class CommitImportDto {
  @IsString()
  @MinLength(1)
  csv: string;

  /** Maps each CSV member name to an existing userId in this group. */
  @IsObject()
  memberMap: Record<string, string>;
}
