import { IsNumber, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number;
}
