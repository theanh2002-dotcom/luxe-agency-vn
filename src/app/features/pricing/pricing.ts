import { Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-pricing',
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './pricing.html',
  styleUrl: './pricing.scss'
})
export class Pricing {
  standalone = input<boolean>(false);
}
