#include "main.h"
#include <util/delay.h>

int main(void)
{
    DDRB |= (1 << PB4);
    PORTB &= ~(1 << PB4);

    while (1) {
        PORTB ^= (1 << PB4);
        _delay_ms(150);        
        PORTB ^= (1 << PB4);
        _delay_ms(250);        
        PORTB ^= (1 << PB4);
        _delay_ms(150);      
        PORTB ^= (1 << PB4);
        _delay_ms(1800);        
    }
   
}