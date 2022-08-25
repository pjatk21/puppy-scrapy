import { gql } from '@apollo/client/core'

export const processFragmentMutation = gql`
  mutation ProcessFragment($html: String!) {
    processFragment(html: $html) {
      id
      code
      groups
      begin
    }
  }
`

export const tasksSubscription = gql`
  subscription Dispositions {
    tasksDispositions {
      id
      name
      state
      until
      since
    }
  }
`
