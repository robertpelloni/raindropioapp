import React, { useState, useCallback, useMemo } from 'react'
import t from '~t'
import { useDispatch } from 'react-redux'
import { loginWithPassword } from '~data/actions/user'
import sessionStorage from '~modules/sessionStorage'

import { Helmet } from 'react-helmet'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Layout, Text, Label } from '~co/common/form'
import Button from '~co/common/button'
import Social from '../social'
import Alert from '~co/common/alert'

export default function AccountLogin() {
    const dispatch = useDispatch()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [search] = useSearchParams()
    const navigate = useNavigate()
    const redirect = sessionStorage.getItem('redirect') || (process.env.NODE_ENV == 'development' ? window.location.origin : '')

    const error = useMemo(()=>{
        const { error } = Object.fromEntries(new URLSearchParams(search))||{}
        return error
    }, [search])

    const onChangeEmailField = useCallback(e=>setEmail(e.target.value), [])
    const onChangePasswordField = useCallback(e=>setPassword(e.target.value), [])

    const onFail = useCallback((e)=>{
        setLoading(false)
        alert(e.message || 'Login failed. Please check your credentials.')
    }, [])

    const onSuccess = useCallback(()=>{
        if (redirect && !redirect.includes('app.raindrop.io'))
            window.location.href = redirect
        else
            navigate('/', { replace: true })
    }, [redirect, navigate])

    const onSubmit = useCallback(e=>{
        e.preventDefault()
        if (loading) return
        setLoading(true)

        dispatch(loginWithPassword({ email, password }, onSuccess, onFail))
    }, [email, password, loading, dispatch, onSuccess, onFail])

    return (
        <form onSubmit={onSubmit}>
            <Helmet><title>{t.s('signIn')}</title></Helmet>

            <Layout>
                {error ? (
                    <Alert variant='danger'>{error}</Alert>
                ) : null}

                <Label>{t.s('emailOrUsername')}</Label>
                <Text
                    type='text'
                    name='email'
                    autoFocus
                    required
                    inputMode='email'
                    autoCapitalize='none'
                    spellCheck='false'
                    value={email}
                    onChange={onChangeEmailField} />

                <Label>
                    {t.s('password')}
                    <Button 
                        as={Link}
                        size='small'
                        variant='link'
                        to='/account/lost'
                        tabIndex='1'>
                        {t.s('recoverPassword')}
                    </Button>
                </Label>
                <Text
                    type='password'
                    name='password'
                    required
                    value={password}
                    onChange={onChangePasswordField} />

                <input type='hidden' name='redirect' value={redirect} />

                <Button
                    as='input'
                    type='submit'
                    variant='primary'
                    data-block
                    disabled={loading}
                    value={t.s('signIn')} />

                <Social />

                <Button
                    as={Link}
                    to='/account/signup'
                    variant='link'
                    data-block>
                    {t.s('register')}
                </Button>
            </Layout>
        </form>
    )
}