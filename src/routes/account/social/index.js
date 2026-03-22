import s from './index.module.styl'
import t from '~t'
import React from 'react'
import { API_ENDPOINT_URL } from '~data/constants/app'
import sessionStorage from '~modules/sessionStorage'

import { Separator } from '~co/common/form'
import Button from '~co/common/button'
import Icon from '~co/common/icon'

export default function AccountSocialLogin({ disabled }) {
    const redirect = sessionStorage.getItem('redirect') || ''

    return (<>
        <Separator />
        {['google', 'apple'].map(vendor=>(
            <Button 
                key={vendor}
                className={s[vendor]+' '+s.vendor}
                variant='outline'
                disabled={disabled}
                data-block
                href={`${process.env.NODE_ENV == 'development' ? '/v1/' : API_ENDPOINT_URL}auth/${vendor}?redirect=${encodeURIComponent(redirect || (process.env.NODE_ENV == 'development' ? window.location.origin : ''))}`}>
                <Icon name={vendor} className={s.icon} /> {t.s('signInSocial')} <span>{vendor}</span>
            </Button>
        ))}
    </>)
}